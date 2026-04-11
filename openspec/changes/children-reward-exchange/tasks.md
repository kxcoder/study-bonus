## 1. 数据库搭建

- [x] 1.1 创建 CloudBase MySQL 数据库实例
- [x] 1.2 创建 users 表 (id, openid, nickname, role, points_balance, created_at)
- [x] 1.3 创建 prizes 表 (id, name, description, points_cost, inventory, image_url, is_active)
- [x] 1.4 创建 reward_applications 表 (id, user_id, description, status, points, admin_note, created_at, reviewed_at)
- [x] 1.5 创建 redemption_applications 表 (id, user_id, prize_id, status, admin_note, created_at, reviewed_at)
- [x] 1.6 插入初始管理员账号
- [x] 1.7 插入示例奖品数据

## 2. 云函数 - 认证模块

- [x] 2.1 创建 login 云函数（微信登录 → 获取/创建用户）
- [x] 2.2 创建 get-user 云函数（获取当前用户信息）
- [x] 2.3 创建 update-nickname 云函数
- [x] 2.4 添加基于角色的访问中间件

## 3. 云函数 - 奖励模块

- [x] 3.1 创建 submit-reward 云函数
- [x] 3.2 创建 list-rewards 云函数（用户自己的）
- [x] 3.3 创建 list-pending-rewards 云函数（管理员）
- [x] 3.4 创建 approve-reward 云函数（带事务）
- [x] 3.5 创建 reject-reward 云函数

## 4. 云函数 - 奖品模块

- [x] 4.1 创建 list-prizes 云函数（奖品目录）
- [x] 4.2 创建 get-prize 云函数（详情）
- [x] 4.3 创建 create-prize 云函数（管理员）
- [x] 4.4 创建 update-prize 云函数（管理员）
- [x] 4.5 创建 deactivate-prize 云函数（管理员）

## 5. 云函数 - 兑换模块

- [x] 5.1 创建 submit-redemption 云函数
- [x] 5.2 创建 list-redemptions 云函数（用户自己的）
- [x] 5.3 创建 list-pending-redemptions 云函数（管理员）
- [x] 5.4 创建 approve-redemption 云函数（带事务）
- [x] 5.5 创建 reject-redemption 云函数

## 6. 云函数 - 管理员与分享

- [x] 6.1 创建 get-dashboard 云函数
- [x] 6.2 创建 get-application 云函数（按 ID 和类型）
- [x] 6.3 创建 generate-share-link 云函数
- [x] 6.4 创建 quick-approve 云函数（用于分享链接）

## 7. 小程序 - 孩子版

- [x] 7.1 创建微信小程序项目结构
- [x] 7.2 实现微信登录页面
- [x] 7.3 实现首页（积分余额显示）
- [x] 7.4 实现奖励提交页面
- [x] 7.5 实现奖励历史页面
- [x] 7.6 实现奖品目录页面
- [x] 7.7 实现奖品详情页面
- [x] 7.8 实现兑换申请页面
- [x] 7.9 实现兑换历史页面

## 8. 小程序 - 管理员版

- [x] 8.1 创建管理员小程序项目结构
- [x] 8.2 实现管理员登录页面
- [x] 8.3 实现仪表盘页面（待审核数量）
- [x] 8.4 实现奖励审核列表页面
- [x] 8.5 实现奖励审核详情页面
- [x] 8.6 实现兑换审核列表页面
- [x] 8.7 实现兑换审核详情页面
- [x] 8.8 实现奖品管理页面
- [x] 8.9 实现分享链接处理页面

## 9. 测试与部署

- [ ] 9.1 本地测试云函数
- [ ] 9.2 测试孩子小程序流程
- [ ] 9.3 测试管理员小程序流程
- [ ] 9.4 测试分享给管理员流程
- [ ] 9.5 部署云函数到 CloudBase
- [ ] 9.6 上传孩子小程序
- [ ] 9.7 上传管理员小程序