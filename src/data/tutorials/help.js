export default {
  id: 'help',
  title: 'Help & Training',
  group: 'HELP',
  roles: ['Any staff'],
  summary: 'Step-by-step guides for every module, a list of what has changed, recommended training paths by job, and a tracker of what you have already learned.',
  before: [],
  tabs: [
    { name: "✨ What's new", what: 'Everything that changed, newest first. Filter by New, Improved, Fixed or Security. "Learn how →" opens the guide.' },
    { name: '📚 Module guides', what: 'Search and read the guide for any module you can open.' },
    { name: '🎯 Training paths', what: 'A recommended order of guides for your job (accountant, reception, teacher, housemaster, administrator).' },
  ],
  steps: [
    { title: 'Learn a module', body: [
      'Open Help & Training from the sidebar (or press the "📖 Help" button at the top of any page).',
      'Choose "📚 Module guides" and pick the module on the left, or type a word in the search box.',
      'Read "Before you start", then open each "Step by step" item.',
      'When you are confident, tick "Mark as learned". Your progress bar at the top moves.',
    ] },
    { title: 'Follow a training path', body: [
      'Open "🎯 Training paths" and pick the path that matches your job.',
      'Work through the guides in the order shown. Ticks appear as you mark them learned.',
    ] },
    { title: 'Print a guide', body: ['Open the guide and press "🖨 Print guide". Allow pop-ups if your browser asks.'] },
  ],
  tips: ['Your "learned" ticks are saved in this browser only, so they stay on this computer/phone.', 'Use "Only modules I can open" to hide guides for modules you do not have access to.'],
  mistakes: ['Looking for a guide for a module you cannot open → untick "Only modules I can open" to read it anyway.'],
  faq: [
    { q: 'Who updates these guides?', a: 'They are written from the real screens. When a feature changes, the guide and the "What\'s new" list are updated together.' },
    { q: 'Is my progress shared with the admin?', a: 'No. It is stored only in your own browser.' },
  ],
  related: ['dashboard'],
}
