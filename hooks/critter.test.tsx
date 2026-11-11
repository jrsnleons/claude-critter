import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'critter-hud',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 12, bodyColumns: 80, scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

const PANE = {
  plugin: 'critter-hud',
  component: 'Pane',
  requestId: 'critter',
  props: {
    title: 'Critter',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('on desktop the critter lives in a transparent pane, not the band', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const opened: unknown[] = []
  on('command.register', () => ({ value: { command: 'critter' } }))
  on('ui.open', (_, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: '/src/app.ts' })
  expect(opened).toEqual([
    expect.objectContaining({ id: 'critter', backgroundColor: 'transparent' }),
  ])

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await pane.find({ type: 'Svg' }))?.props.alt).toBe('Critter: Reading app.ts')
  await pane.unmount()

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Svg' })).toBeUndefined()
  await band.unmount()
})

test('the critter acts out a Read, on desktop and terminal', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'critter' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Read', file_path: '/src/auth.ts' })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pic = await desk.find({ type: 'Svg' })
  expect(pic?.props.alt).toBe('Critter: Reading auth.ts')
  await desk.unmount()

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await term.find({ type: 'Text', text: /Reading auth\.ts/ }))?.text).toBe('Reading auth.ts')
  await term.unmount()
})

test('a subagent tool call updates its own row, not the main critter', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'critter' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'npm test', description: 'Run the tests' })
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' })

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await desk.find({ type: 'Svg' }))?.props.alt).toBe('Critter: Run the tests')
  await desk.unmount()
})

test('the desktop band is one full-width drawing with no buttons', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'critter' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.findAll({ type: 'Button' })).toHaveLength(0)
  const source = String((await desk.find({ type: 'Svg' }))?.props.source)
  expect(source).toContain('1 tool this turn')
  await desk.unmount()
})

test('the task list becomes a plan bar', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('command.register', () => ({ value: { command: 'critter' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Draw critter', status: 'completed', activeForm: 'Drawing' },
      { content: 'Write hooks', status: 'in_progress', activeForm: 'Writing' },
      { content: 'Test', status: 'pending', activeForm: 'Testing' },
    ],
  } as never)

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await term.find({ type: 'Text', text: /^Plan/ }))?.text).toMatch(/1\/3 · Write hooks/)
  await term.unmount()
})
