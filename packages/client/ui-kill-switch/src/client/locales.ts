/**
 * `kill-switch` namespace dictionaries.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'switch.description': '一键取消所有会话正在运行的回合',
  'switch.option': '停止一切',
  'switch.confirmTitle': '停止所有会话？',
  'switch.confirmDescription': '将对当前列表中的每一个会话发送取消指令；排队中的消息会保留，运行中的回合会尽快中断。',
  'switch.acknowledge': '我了解这会中断所有正在生成的回复',
  'switch.cancelLabel': '返回',
  'switch.confirmLabel': '全部停止',
  'switch.result': '已向 {accepted}/{total} 个会话发送停止指令',
} satisfies Record<string, string>

/** The kill-switch namespace key union. */
export type KillSwitchKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'switch.description': "Cancel every session's running turn in one stroke",
  'switch.option': 'Stop everything',
  'switch.confirmTitle': 'Stop all sessions?',
  'switch.confirmDescription': 'Every session in the list receives a cancel; queued messages are kept and running turns are interrupted as soon as possible.',
  'switch.acknowledge': 'I understand this interrupts every generating reply',
  'switch.cancelLabel': 'Go back',
  'switch.confirmLabel': 'Stop all',
  'switch.result': 'Sent stop to {accepted}/{total} sessions',
} satisfies Record<KillSwitchKey, string>
