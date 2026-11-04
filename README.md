# NeteaseMusic Analyze

个人网易云音乐听歌数据分析工具。

计划通过 [网易云音乐 API Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 获取账号可访问的听歌数据，在本地保存并分析歌曲排行、歌手偏好和周期变化。

## 项目状态

仓库初始化完成，应用功能尚未开发。

## 开发方向

- 扫码登录与听歌数据同步。
- 保存原始响应、排行快照、周期报告和同步日志。
- 展示歌曲与歌手排行、收听时长和周月趋势。
- 支持数据导出与本地备份。

统计结果应注明数据来源和覆盖范围；缺失数据不按零处理，排行快照不直接视为逐次播放记录。

## 拟采用的技术

- 前端：React、TypeScript、Vite、Apache ECharts。
- 后端：Node.js、TypeScript、Express。
- 存储：SQLite。

账号凭证、个人听歌数据和本地数据库不提交到 Git 仓库。
