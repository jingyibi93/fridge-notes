# 冰箱便签：多人协同内测设置

这一版先做“协同 MVP”：一个冰箱的数据会作为完整快照同步到 Supabase。
优点是接入快，适合第一轮内测；正式 App 上线前，需要再拆成更细的数据表和更严格的权限。

## 1. 创建 Supabase 项目

在 Supabase 新建一个项目，进入项目后找到：

- Project URL
- anon public key

注意：只使用 `anon public key`，不要把 `service_role` key 放进前端。

## 2. 创建同步表

打开 Supabase 的 SQL Editor，把 `supabase-schema.sql` 里的内容复制进去运行。

文件位置：

```text
/Users/jingyibi/Documents/Codex/2026-06-09/codex/outputs/fridge-memo-app/supabase-schema.sql
```

## 3. 填写本地配置

打开：

```text
/Users/jingyibi/Documents/Codex/2026-06-09/codex/outputs/fridge-memo-app/js/supabase-config.js
```

改成类似这样：

```js
window.FridgeSupabaseConfig = {
  enabled: true,
  url: "https://你的项目编号.supabase.co",
  anonKey: "你的 anon public key",
  stateTable: "fridge_states"
};
```

## 4. 测试多人协同

打开同一个线上预览链接，或者在两台设备上打开同一个地址。

建议测试：

- A 创建冰箱，复制邀请码
- B 用邀请码加入
- A 贴便签，B 看是否同步出现
- B 评论，A 看是否收到更新
- A 整理冰箱，B 看是否同步位置

## 5. 当前限制

这是内测验证版，不是正式上线架构：

- 目前是整冰箱快照同步，不是每张便签单独同步
- 两个人完全同时编辑同一张便签时，后保存的人可能覆盖前一个人的改动
- 照片目前仍可能以压缩后的数据放进快照，正式版应该改用 Supabase Storage
- 现在的权限为了方便内测较宽松，正式版必须接登录和家庭成员权限

