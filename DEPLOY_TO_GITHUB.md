# 部署到 GitHub / Railway

这个文件夹是“冰箱便签”的 PWA 版本。

Railway 当前连接的仓库是：

```text
https://github.com/jingyibi93/fridge-notes
```

上传方式：

1. 打开 GitHub 仓库。
2. 进入仓库根目录。
3. 点击 `Add file`。
4. 选择 `Upload files`。
5. 把本文件夹里的文件和文件夹拖进去。
6. 提交信息填写：`deploy: 冰箱便签 PWA`
7. 点击绿色提交按钮。
8. 等 Railway 自动部署完成。

部署完成后打开：

```text
https://fridge-web-production.up.railway.app
```

如果要让不同手机同步，还需要在 `js/supabase-config.js` 里填写 Supabase 配置。
