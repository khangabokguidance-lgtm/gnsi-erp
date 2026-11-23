// Navigation map for the Mission Sainik app shell: [tab id, icon, label].
export const NAV_GROUPS = [
  { title: 'Plan', items: [['overview', '🏠', 'Home'], ['schedule', '📅', 'Schedule'], ['mock', '🎯', 'Mock series'], ['allotment', '👥', 'Allotment'], ['syllabus', '📘', 'Syllabus'], ['panel', '🧑‍🏫', 'Panel'], ['students', '🎓', 'Students']] },
  { title: 'My work', items: [['mine', '✅', 'Tasks'], ['material', '📎', 'Study material']] },
  // Practice Maker is its own area, apart from the Pre Mock papers: practice sets are PB-NN, Pre Mock tests are PMT-NN.
  { title: 'Practice Maker', items: [['practice', '🗂️', 'Practice bank'], ['practicebuilder', '🧩', 'Practice Maker']] },
  { title: 'Build papers', items: [['prebuilder', '🧱', 'Pre Mock'], ['megabuilder', '🏗️', 'Mega Mock'], ['dailybuilder', '🗓️', 'Daily Test'], ['admit', '🪪', 'Admit cards']] },
  { title: 'Results', items: [['marks', '📝', 'Class test marks'], ['mockmarks', '✍️', 'Mock marks'], ['premock', '📊', 'Pre analyzer'], ['megamock', '📈', 'Mega analyzer'], ['activity', '🏃', 'Teachers'], ['certs', '🏆', 'Certificates'], ['insights', '💡', 'Insights']] },
  { title: 'Help', items: [['guide', '❓', 'How to use'], ['admin', '⚙️', 'Admin']] },
]
