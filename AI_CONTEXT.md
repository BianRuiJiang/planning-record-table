# 规划记录表 - 项目记忆

## 项目目标
- 独立的 React + Vite + TypeScript + Supabase 规划记录应用。
- 复用「个人时间追踪」的 Supabase 项目、登录用户和 `activities` 数据；不改动该项目源码。

## 核心规则
- 日周期为北京时间 05:00 到次日 05:00，05:00 前归属前一天；页面标题显示周期起始日。
- 只新增规划表，禁止修改或删除已有表；前端对 `activities` 只做 SELECT。
- 计划与实际两侧结构完全对称；首屏固定 3 对输入，导入超过 3 条时只在模块内滚动。
- 今日任务固定左右各 3 个，单侧满 3 个后禁止新增；已有超量数据可在模块内滚动并删除。
- 整页禁止滚动；计划/实际和反思超出内容只在各自模块内滚动。
- 时间追踪记录是单个时间点时只能导入为开始时间，不得用相邻记录间隔推算耗时。
- 导入用 `source_activity_id` 去重。
- 输入停止 800ms 后自动保存，保存状态必须可见，失败必须提示。
- 配色使用冷静自然色板：绿色=完成/进行中，蓝色=时间，红色仅删除/错误。

## 进度
- 已完成阶段0：已核对时间追踪项目的技术栈、登录、表结构和 05:00 规则。
- 已在 Supabase SQL Editor 执行 `supabase/planning.sql`；三张 `planning_*` 表均存在且 RLS 为 true。
- 已完成独立 React + Vite 应用：登录、05:00 周期、天气/心态、任务、对称计划/实际、自动保存、反思、导入去重。
- 已通过 6 项 Vitest、`npm run typecheck` 和 `npm run build`；未登录 REST 校验读取/写入均被拒绝。
- 已部署 GitHub Pages：`https://bianruijiang.github.io/planning-record-table/`。
- 已修复：快速连续修改多个日字段时合并提交；非法日期变更被拦截；渲染异常有错误边界。
- 已实测：任务增改删/完成、对称行增删、耗时自动/手动/跨天、刷新持久化、换日隔离、时间追踪导入和重复点击去重。
- 2026-11-18 已导入 14 条实际记录；重复导入仍为 14 条。测试任务/记录和非法日期行已清理。
- 已改为纸质日程式一屏布局；已实测整页无滚动、14 条记录在模块内滚动、任务单侧满 3 个后新增禁用。

## 待确认
- 本地 `.env.local` 需要 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`，不提交仓库。
- GitHub Actions 已配置两个 VITE Supabase Secret；值未入库。
- GitHub Pages 到 Supabase 偶发一次 `Failed to fetch`，重试后成功；这是公网直连的已知风险。
