# 🌟 前端开发规范（简洁版 · 适用于轻量系统）

## 1. 🌐 技术栈约定

### 必须使用：

* **Alpine.js**：页面交互，数据绑定
* **Axios**：API 请求
* **TailwindCSS**：样式
* **原生 ES Modules**：结构化前端代码
* **简单 SSR 或静态 HTML**（不使用 SPA 框架）

### 不使用：

❌ jQuery
❌ React / Vue / Svelte
❌ Webpack / Vite（如无特殊需要）
❌ html 中写大量 JS

---

# 2. 📁 目录结构规范

**所有前端文件以模块划分，不要写在一个文件里。**

示例目录：

```
frontend/
  index.html
  pages/
    dashboard.html
    users.html
  js/
    app.js            # 全局初始化
    api.js            # axios 封装
    utils.js          # 公共方法
    stores/
      user.js         # 全局数据存取逻辑
      product.js
    components/
      modal.js        # 可复用组件逻辑
      table.js
  css/
    tailwind.css
```

---

# 3. 📦 JS 代码规范

## 3.1 模块化（强制要求）

所有 JS 都必须用 ES Module：

```html
<script type="module" src="/js/app.js"></script>
```

模块内使用命名导出：

```js
export function fetchUsers() {}
export const APP_VERSION = "1.0.0";
```

---

## 3.2 不要在 HTML 内写复杂 JS

禁止这样：

```html
<div x-data="{a:1,b:2,c:() => alert(1)}">
```

推荐：

```html
<div x-data="userList()">
```

在 JS 模块里：

```js
export function userList() {
  return { users: [], load(){...} }
}
```

---

## 3.3 状态必须封装

推荐使用 Alpine.store 做全局状态：

```js
Alpine.store('auth', {
  user: null,
  setUser(u) { this.user = u }
});
```

---

## 3.4 所有 API 请求必须通过 api.js

不要在页面中直接写 axios 调用。

严格遵循：

```
页面组件 → 调 store → store 调 api
```

示例：

### api.js

```js
import axios from 'https://cdn.jsdelivr.net/npm/axios/+esm';

export const api = axios.create({
  baseURL: "/api",
  timeout: 8000
});
```

### store/user.js

```js
import { api } from '../api.js';

export default {
  async list() {
    const { data } = await api.get('/users');
    return data;
  }
}
```

---

# 4. 🎨 样式规范（Tailwind）

## 4.1 不写传统 CSS（除非组件级扩展）

Tailwind 提供的类优先使用。

禁止：

```css
.card { padding: 20px; }
```

推荐：

```html
<div class="p-5 bg-white rounded-xl shadow-md"></div>
```

---

## 4.2 组件样式写在 HTML

除非组件需要大量复用样式，才写 CSS 或 Tailwind layer：

```css
@layer components {
  .btn-primary {
    @apply bg-blue-600 text-white px-4 py-2 rounded;
  }
}
```

---

# 5. 🗂 HTML 结构规范

## 5.1 每个页面只负责布局

不要在页面中写逻辑，所有逻辑放到 JS 模块里。

推荐页面写法：

```html
<div x-data="userList()" class="p-8">
  <button @click="loadUsers">Load</button>

  <template x-for="u in users">
    <div x-text="u.name"></div>
  </template>
</div>
```

---

## 5.2 组件必须是可复用的

示例：

```
components/modal.js
components/table.js
components/pagination.js
```

每个组件必须遵循：

* 自己的 x-data
* 自己的事件范围
* 不依赖全局 DOM

---

# 6. 🔄 API 交互规范

## 6.1 后端所有接口返回 JSON

结构统一：

```json
{
  "success": true,
  "data": [],
  "message": "ok"
}
```

---

## 6.2 前端必须统一处理错误

在 api.js：

```js
api.interceptors.response.use(
  res => res,
  err => {
    alert(err.response?.data?.message || "Network error");
    throw err;
  }
);
```

---

## 6.3 loading / error 状态必须在组件中体现

示例：

```js
loading: false,
error: null,

async loadUsers() {
  this.loading = true;
  try {
    this.users = await userStore.list();
  } catch(e) {
    this.error = "加载失败";
  } finally {
    this.loading = false;
  }
}
```

---

# 7. 🧪 命名规范

## 7.1 JS 命名

| 类型  | 格式         | 示例            |
| --- | ---------- | ------------- |
| 变量  | camelCase  | userList      |
| 函数  | camelCase  | fetchUsers    |
| 常量  | UPPER_CASE | API_VERSION   |
| 文件名 | kebab-case | user-store.js |

---

## 7.2 HTML ID/class 命名

推荐使用符合语义的 tailwind 工具类
必要时可添加语义 class：

```
class="user-item"
class="main-wrapper"
```

禁止无意义的：

```
class="box1"
```

---

# 8. 🧱 组件规范

每个组件必须：

1. 有独立 JS 文件（逻辑）
2. 有独立 DOM 块（HTML）
3. 不依赖外部变量（只依赖传入数据）

示例组件 modal.js：

```js
export default function modal() {
  return {
    open: false,
    show() { this.open = true },
    hide() { this.open = false }
  }
}
```

---

# 9. 📐 性能规范

适用于轻量系统：

* 尽量使用 **x-show** 代替 x-if（减少 DOM 重建）
* 大列表务必分页（不要一次渲染全部）
* API 请求做防抖（搜索框）
* 组件内不要反复使用 axios → 使用 store 缓存

---

# 10. 📄 文档与注释规范

每个主要函数必须有注释：

```js
/**
 * Load user list from API
 * @returns {Promise<Array>}
 */
async function listUsers() { ... }
```

页面顶部必须注明用途：

```html
<!-- User List Page -->
```