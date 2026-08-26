# Agent Note: 事件流水作为有界滚动视图目标

Status: implemented

[English](2026-08-25-xray-agent-firehose-view-target.md) | 中文

## Problem

X3 要求一个实时的 `agent/*`/`tools/*` 流水视图与每轮瀑布时序。实时 agent 瀑布从不跨越线路——它们是宿主进程内的事件——但持久会话日志会完整地跨越：已加载窗口内的每条提交事件都会送达浏览器，而没有任何 UI 表面暴露这条原始流。每轮时序此前只存在于 ui-trajectory 私有的阶段布局里。

## Decision

`@deepseek-ai/dsh-client-ui-devtools-agent-firehose` 注册了第三个 `ConversationViewSnapshotMap` 目标 `agent-firehose`，由一个全量捕获的会话 Definition（`kind: 'agent-firehose-event'`，每个事件 seq 一个 context）供数，它匹配每条提交事件，而不受其他业务 Definition 是否匹配的影响。快照构建器只保留最近 400 行，并在该窗口内通过配对 step 边界与按 `toolCallId` 关联的 call/result 行推导瀑布跨度，因此重放是窗口的纯函数。流式 chunk 行以动画帧节奏发布，避免 token 洪峰冲击渲染。页签作为 devtools 选择项发布：web-app roster 行以 `disabled: true` 插入，需在更晚补丁层替换该行来启用（与 prompt inspector 相同协议）。

有界滚动窗口是视图快照的一条刻意新约定：既有构建器全量保留并在渲染期虚拟化。上限正是让"每事件"目标可负担的关键，400 被定义为本包 wire 形状的常量。

## Alternatives considered

- 复用 trajectory 的时序模型：否决——禁止跨包导入其他插件内部，且其面向阶段的 cell 不是事件台账。
- 宿主侧投影承载流水：否决——事件已原样到达浏览器，宿主再折叠一次既重复劳动又为客户端已有的数据增加检查点状态。
- 无界保留 + 渲染期虚拟化：v1 否决——每事件 context 下无界增长会使内存二次膨胀；用上限明确记录这一取舍。

## Consequences

闭合行已离开窗口的跨度会渲染为开放或消失，起始行离开的轮次没有轮级边界——README 记录了窗口语义。每事件 seq 一个 context 会在大窗口下放大 assembler 工作量，对默认关闭的开发工具可以接受，但不是产品表面的范式。未知的可扩展事件类型退化为 JSON 头部摘要，外来或更新的日志仍可渲染。
