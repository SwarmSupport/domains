# Domain Management System - 域名管理系统

## 1. Concept & Vision

一个专业、高效的域名管理系统，为域名经销商和终端用户提供一体化的域名管理解决方案。系统以深蓝色为主色调，搭配科技感的渐变效果，营造出专业可信的域名服务氛围。界面简洁直观，操作流畅，让域名管理变得轻松愉快。

## 2. Design Language

### 色彩系统
- **主色调**: `#1e3a5f` (深海蓝) - 传递专业与信任
- **次要色**: `#2d5a87` (天际蓝) - 用于卡片和区块背景
- **强调色**: `#00d4aa` (科技青) - 用于按钮、链接和成功状态
- **警告色**: `#ff6b6b` (珊瑚红) - 用于错误和删除操作
- **背景色**: `#0f1724` (深夜蓝) - 主背景
- **卡片背景**: `#1a2744` (暗蓝灰) - 卡片和容器
- **文字色**: `#e8f4f8` (冰白) - 主要文字
- **次要文字**: `#8ba3b9` (灰蓝) - 辅助文字

### 字体
- **标题**: "Outfit", system-ui, sans-serif (现代几何感)
- **正文**: "Inter", system-ui, sans-serif (高可读性)

### 空间系统
- 基础单位: 4px
- 间距: 8px, 16px, 24px, 32px, 48px
- 圆角: 8px (小), 12px (中), 16px (大), 24px (卡片)

### 动效
- 过渡时长: 200ms (快), 300ms (标准), 500ms (慢)
- 缓动函数: cubic-bezier(0.4, 0, 0.2, 1)
- 悬停效果: 轻微上浮 + 阴影加深
- 页面切换: 淡入淡出 + 轻微位移

### 图标
- 使用 Lucide Icons (线性风格)

## 3. Layout & Structure

### 页面结构
```
┌─────────────────────────────────────────────────────┐
│  Header (Logo + 用户信息 + 退出)                     │
├─────────────┬───────────────────────────────────────┤
│             │                                       │
│  Sidebar    │         Main Content Area             │
│  (导航菜单)   │                                       │
│             │                                       │
│             │                                       │
└─────────────┴───────────────────────────────────────┘
```

### 响应式策略
- 桌面端 (>1200px): 侧边栏展开 + 宽内容区
- 平板端 (768-1200px): 侧边栏可折叠
- 移动端 (<768px): 底部导航栏

### 页面列表
1. **登录页** `/login` - 用户登录
2. **注册页** `/register` - 用户注册
3. **仪表盘** `/dashboard` - 概览统计
4. **域名列表** `/domains` - 域名管理
5. **DNS解析** `/dns/:domain` - 域名解析记录管理
6. **用户管理** `/admin/users` - 管理员用户管理 (仅管理员)
7. **域名分配** `/admin/domains` - 域名分配管理 (仅管理员)

## 4. Features & Interactions

### 用户认证
- **注册**: 用户名、邮箱、密码、确认密码
  - 验证: 用户名 3-20字符，邮箱格式，密码 6位以上
  - 成功: 自动登录并跳转仪表盘
  - 失败: 显示具体错误信息
- **登录**: 邮箱 + 密码
  - 记住登录状态 (7天)
  - 错误: 显示"邮箱或密码错误"
- **登出**: 清除 Token，跳转登录页

### 域名管理
- **列表展示**: 卡片式展示，显示域名、状态、到期时间
- **添加域名**: 输入域名，管理员审核后分配
- **删除域名**: 二次确认后删除
- **筛选**: 按状态(全部/已解析/未解析)筛选

### DNS 解析 (DNSPod 集成)
- **记录类型**: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA
- **添加记录**:
  - 主机记录、记录类型、记录值、优先级、TTL
  - 实时同步到 DNSPod
- **编辑记录**: 点击编辑，保存后同步
- **删除记录**: 二次确认后删除
- **批量操作**: 勾选多条记录后批量删除/启用/禁用

### 管理员功能
- **用户管理**: 查看所有用户、修改用户角色(普通用户/管理员)、禁用用户
- **域名分配**: 查看待审核域名、分配域名给用户、查看用户域名列表
- **系统设置**: DNSPod Token 配置

### 错误处理
- 网络错误: 显示重试按钮
- 表单验证: 实时验证 + 提交时验证
- 操作反馈: 成功 toast / 错误 toast

## 5. Component Inventory

### Button
- **变体**: primary, secondary, danger, ghost
- **尺寸**: sm, md, lg
- **状态**: default, hover(上浮+亮), active(按下), disabled(opacity 0.5), loading(spinner)

### Input
- **状态**: default, focus(边框高亮+阴影), error(红色边框+错误信息), disabled
- **类型**: text, email, password (带显示/隐藏切换)

### Card
- 背景: 卡片背景色
- 边框: 1px solid rgba(255,255,255,0.1)
- 阴影: 0 4px 20px rgba(0,0,0,0.3)
- 悬停: 边框变亮，轻微上浮

### Modal
- 背景遮罩: rgba(0,0,0,0.7)
- 动画: 缩放 + 淡入
- 关闭: 点击遮罩 / ESC 键 / 关闭按钮

### Toast
- 位置: 右上角
- 类型: success(青色), error(红色), info(蓝色), warning(橙色)
- 自动消失: 3秒

### Table
- 表头: 深色背景
- 行悬停: 背景变亮
- 斑马纹: 可选

### Sidebar
- 宽度: 240px (展开) / 64px (折叠)
- 导航项: 图标 + 文字，悬停高亮
- 当前页: 左侧高亮条 + 背景高亮

## 6. Technical Approach

### 前端
- **框架**: Vue 3 + Composition API + TypeScript
- **构建**: Vite
- **路由**: Vue Router 4
- **状态**: Pinia
- **HTTP**: Axios
- **样式**: CSS Variables + Scoped CSS

### 后端
- **框架**: Express.js
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT (jsonwebtoken)
- **密码**: bcrypt

### API 设计

#### 认证
```
POST /api/auth/register    - 用户注册
POST /api/auth/login       - 用户登录
GET  /api/auth/me           - 获取当前用户
```

#### 用户管理 (管理员)
```
GET    /api/users           - 获取用户列表
PUT    /api/users/:id       - 更新用户信息
DELETE /api/users/:id       - 删除用户
```

#### 域名
```
GET    /api/domains          - 获取域名列表
POST   /api/domains          - 申请域名
PUT    /api/domains/:id      - 更新域名信息
DELETE /api/domains/:id      - 删除域名
POST   /api/domains/:id/assign - 分配域名给用户 (管理员)
```

#### DNS 记录
```
GET    /api/dns/:domain/records     - 获取解析记录
POST   /api/dns/:domain/records     - 添加解析记录
PUT    /api/dns/:domain/records/:id  - 更新解析记录
DELETE /api/dns/:domain/records/:id - 删除解析记录
```

### 数据模型

#### User
```typescript
{
  id: number
  username: string
  email: string
  password: string (hashed)
  role: 'user' | 'admin'
  created_at: datetime
}
```

#### Domain
```typescript
{
  id: number
  name: string
  user_id: number | null  // null 表示未分配
  status: 'pending' | 'active' | 'suspended'
  expires_at: datetime
  dnspod_domain_id: string | null
  created_at: datetime
}
```

#### DnsRecord
```typescript
{
  id: number
  domain_id: number
  record_id: string  // DNSPod 记录 ID
  name: string
  type: string
  value: string
  priority: number
  ttl: number
  enabled: boolean
  created_at: datetime
}
```

#### Setting
```typescript
{
  key: string
  value: string
}
// DNSPOD_TOKEN 存储在此
```

### DNSPod API 集成
- 使用 DNSPod API v6
- Token 认证: `login_token=ID,TOKEN`
- 同步操作: 添加/修改/删除记录实时同步到 DNSPod
