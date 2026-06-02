/**
 * CrossModuleSync — Automatic Data Propagation Between Modules
 * Handles the "when X happens in Module A, update Module B" logic
 */

import { EventBus, GNSI_EVENTS } from './EventBus'
import { supabase } from './supabase'

class CrossModuleSync {
  constructor() {
    this.unsubscribers = []
    this.init()
  }

  init() {
    // 1. When attendance is marked → Update staff scoring (p1_attendance)
    this.unsubscribers.push(
      EventBus.on(GNSI_EVENTS.ATTENDANCE_MARKED, async ({ staffId, date, status }) => {
        const month = date.slice(0, 7)
        const { data: existing } = await supabase
          .from('staff_monthly_scores')
          .select('*')
          .eq('staff_id', staffId)
          .eq('month', month)
          .single()

        if (existing) {
          const presentDelta = status === 'Present' ? 1 : 0
          const newPresent = (existing.days_present || 0) + presentDelta
          await supabase
            .from('staff_monthly_scores')
            .update({ days_present: newPresent })
            .eq('id', existing.id)

          EventBus.emit(GNSI_EVENTS.SCORE_UPDATED, { staffId, month })
        }
      })
    )

    // 2. When geo check-in happens → Auto-mark daily attendance as Present
    this.unsubscribers.push(
      EventBus.on(GNSI_EVENTS.GEO_CHECKIN, async ({ staffId, timestamp }) => {
        const date = new Date(timestamp).toISOString().slice(0, 10)
        await supabase.from('attendance_logs').upsert({
          staff_id: staffId,
          date,
          status: 'Present',
          marked_by: 'Geo',
          check_in_time: timestamp,
          geo_verified: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'staff_id,date' })

        EventBus.emit(GNSI_EVENTS.ATTENDANCE_MARKED, { 
          staffId, date, status: 'Present', markedBy: 'Geo' 
        })
      })
    )

    // 3. When task is completed → Update score (p3_tasks)
    this.unsubscribers.push(
      EventBus.on(GNSI_EVENTS.TASK_COMPLETED, async ({ staffId, taskId }) => {
        const month = new Date().toISOString().slice(0, 7)
        // Recalculate tasks_completed_on_time for this staff
        const { data: tasks } = await supabase
          .from('staff_tasks')
          .select('*')
          .eq('assigned_to', staffId)
          .eq('status', 'Done')
          .gte('completed_at', `${month}-01`)

        const completed = tasks?.length || 0
        const { data: score } = await supabase
          .from('staff_monthly_scores')
          .select('*')
          .eq('staff_id', staffId)
          .eq('month', month)
          .single()

        if (score) {
          await supabase
            .from('staff_monthly_scores')
            .update({ tasks_completed_on_time: completed })
            .eq('id', score.id)

          EventBus.emit(GNSI_EVENTS.SCORE_UPDATED, { staffId, month })
        }
      })
    )

    // 4. When salary is paid → Update advance repayment
    this.unsubscribers.push(
      EventBus.on(GNSI_EVENTS.SALARY_PAID, async ({ staffId, month }) => {
        const { data: salary } = await supabase
          .from('salary')
          .select('advance_deduction')
          .eq('staff_id', staffId)
          .eq('month', month)
          .single()

        if (salary?.advance_deduction > 0) {
          const { data: advances } = await supabase
            .from('staff_advances')
            .select('*')
            .eq('staff_id', staffId)
            .eq('status', 'Active')
            .order('created_at', { ascending: true })

          let remaining = salary.advance_deduction
          for (const adv of advances || []) {
            if (remaining <= 0) break
            const advRem = Number(adv.amount) - Number(adv.repaid_amount)
            const repay = Math.min(remaining, advRem)
            const newRepaid = Number(adv.repaid_amount) + repay

            await supabase
              .from('staff_advances')
              .update({ 
                repaid_amount: newRepaid,
                status: newRepaid >= Number(adv.amount) ? 'Fully Repaid' : 'Active'
              })
              .eq('id', adv.id)

            remaining -= repay
            EventBus.emit(GNSI_EVENTS.ADVANCE_REPAID, { 
              staffId, amount: repay, remaining: advRem - repay 
            })
          }
        }
      })
    )

    // 5. When leave is approved → Mark attendance as Leave for those dates
    this.unsubscribers.push(
      EventBus.on(GNSI_EVENTS.LEAVE_APPROVED, async ({ staffId, startDate, endDate }) => {
        const dates = []
        let current = new Date(startDate)
        const end = new Date(endDate)
        while (current <= end) {
          dates.push(current.toISOString().slice(0, 10))
          current.setDate(current.getDate() + 1)
        }

        for (const date of dates) {
          await supabase.from('attendance_logs').upsert({
            staff_id: staffId,
            date,
            status: 'Leave',
            marked_by: 'System',
            updated_at: new Date().toISOString()
          }, { onConflict: 'staff_id,date' })
        }

        EventBus.emit(GNSI_EVENTS.ATTENDANCE_MARKED, { 
          staffId, date: startDate, status: 'Leave', markedBy: 'System' 
        })
      })
    )

    // 6. When fraud is detected → Flag staff, notify admin, update attendance
    this.unsubscribers.push(
      EventBus.on(GNSI_EVENTS.FRAUD_DETECTED, async ({ staffId, type, details }) => {
        // Update geo attendance status to Flagged
        const today = new Date().toISOString().slice(0, 10)
        await supabase
          .from('staff_geo_attendance')
          .update({ status: 'Flagged', fraud_flags: [{ type, ...details }] })
          .eq('staff_id', staffId)
          .eq('date', today)

        // Create notification for admin
        await supabase.from('admin_notifications').insert({
          type: 'fraud_alert',
          staff_id: staffId,
          message: `Fraud detected: ${type}`,
          details,
          created_at: new Date().toISOString(),
          read: false
        })
      })
    )

    // 7. When session dies → Mark attendance as Absent for remaining shift
    this.unsubscribers.push(
      EventBus.on(GNSI_EVENTS.SESSION_DEAD, async ({ staffId, shiftId }) => {
        const today = new Date().toISOString().slice(0, 10)
        // Only if no checkout happened
        const { data: log } = await supabase
          .from('staff_geo_attendance')
          .select('*')
          .eq('staff_id', staffId)
          .eq('date', today)
          .eq('shift_id', shiftId)
          .single()

        if (log && !log.check_out_time) {
          await supabase
            .from('staff_geo_attendance')
            .update({ status: 'Absent', session_dead: true })
            .eq('id', log.id)

          // Also update daily attendance
          await supabase.from('attendance_logs').upsert({
            staff_id: staffId,
            date: today,
            status: 'Absent',
            marked_by: 'System',
            notes: 'Session died — no checkout recorded',
            updated_at: new Date().toISOString()
          }, { onConflict: 'staff_id,date' })
        }
      })
    )
  }

  destroy() {
    this.unsubscribers.forEach(fn => fn())
    this.unsubscribers = []
  }
}

export const crossModuleSync = new CrossModuleSync()