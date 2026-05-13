function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    { id: 'dashboard',            label: 'Dashboard',           icon: '🏠' },
    { id: 'admissions',           label: 'Admissions',          icon: '📋' },
    { id: 'students',             label: 'Students',            icon: '👨‍🎓' },
    { id: 'attendance',           label: 'Attendance',          icon: '📅' },
    { id: 'exams',                label: 'Exams',               icon: '📝' },
    { id: 'fees',                 label: 'Fees',                icon: '💰' },
    { id: 'accounts',             label: 'Accounts',            icon: '🧾' },
    { id: 'salary',               label: 'Salary',              icon: '💵' },
    { id: 'staff',                label: 'Staff',               icon: '👨‍🏫' },
    { id: 'hr',                   label: 'HR',                  icon: '🗂️' },
    { id: 'leave',                label: 'Leave',               icon: '🏖️' },
    { id: 'timetable',            label: 'Timetable',           icon: '🕐' },
    { id: 'teaching',             label: 'Teaching',            icon: '📚' },
    { id: 'hostel',               label: 'Hostel',              icon: '🏨' },
    { id: 'reception',            label: 'Reception',           icon: '🛎️' },
    { id: 'notices',              label: 'Notices',             icon: '🔔' },
    { id: 'social',               label: 'Social',              icon: '📣' },
    { id: 'connect',              label: 'Connect',             icon: '🔗' },
    { id: 'reports',              label: 'Reports',             icon: '📊' },
    { id: 'management_checklist', label: 'Mgmt Checklist',      icon: '✅' },
    { id: 'admin',                label: 'Admin',               icon: '🔐' },
    { id: 'system',               label: 'System',              icon: '⚙️' },
  ]

  return (
    <div className="h-screen w-64 bg-teal-700 text-white flex flex-col fixed left-0 top-0">

      {/* Logo */}
      <div className="p-5 border-b border-teal-600">
        <h1 className="text-2xl font-bold">GNSI ERP</h1>
        <p className="text-teal-200 text-xs mt-1">School Management System</p>
      </div>

      {/* Scrollable Menu */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg mb-1 transition-all text-sm font-medium
              ${activePage === item.id
                ? 'bg-white text-teal-700'
                : 'text-teal-100 hover:bg-teal-600'
              }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-teal-600">
        <button className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-teal-100 hover:bg-teal-600 text-sm font-medium">
          <span>🚪</span> Logout
        </button>
      </div>

    </div>
  )
}

export default Sidebar