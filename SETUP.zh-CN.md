# MAISON ÉLAN｜Supabase 云端实时接单配置

完成配置后：
顾客手机扫码下单 → Supabase 云端数据库 → 餐厅电脑/平板订单台实时出现。
订单台需要员工邮箱和密码登录，顾客无法读取或修改订单。

## 一、创建 Supabase 项目

1. 打开 Supabase 官网并注册/登录。
2. 创建一个新项目，等待数据库初始化完成。
3. 项目名称可填写：maison-elan-ordering。

## 二、创建数据库和安全策略

1. 打开项目左侧的 SQL Editor。
2. 打开项目文件里的：supabase-setup-v36.sql。
3. 找到：demo@example.com
4. 改成你准备登录商家订单台的邮箱（做公开演示可以保留 demo@example.com）。
5. 复制整个 SQL 文件，粘贴到 SQL Editor 后点击 Run。

这一步会自动创建：
- orders 订单表
- 员工邮箱白名单
- 顾客下单权限
- 员工查看/改状态/删除权限
- 实时订单同步

## 三、创建员工登录账号

1. Supabase 左侧进入 Authentication。
2. 打开 Users。
3. 点击 Add user / Create new user。
4. 邮箱必须与 SQL 中填写的员工邮箱完全一致。
5. 设置密码，并选择直接确认/自动确认该用户（如页面提供此选项）。

以后登录 admin.html 就使用这个邮箱和密码。

## 四、填写项目 URL 和 Publishable Key

1. 在 Supabase 项目设置中找到 API / Data API 页面。
2. 复制 Project URL。
3. 复制 Publishable key。
   - 新项目通常显示 sb_publishable_ 开头的 key。
   - 旧项目显示 anon key 也可以。
4. 用 VS Code 打开：supabase-config-v36.js。
5. 只替换下面两行引号里的内容：

    const MAISON_SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
    const MAISON_SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

注意：
- Publishable/anon key 可以放在前端，安全依靠 RLS 策略控制。
- 绝对不要把 service_role key 放进网页代码或发给客户。

## 五、本地测试跨页面云端接单

1. VS Code 打开整个 maison-elan-menu-v3.7 文件夹。
2. 右键 index.html → Open with Live Server。
3. 顾客菜单地址末尾加入桌号：
   ?table=A01

示例：
http://127.0.0.1:5500/maison-elan-menu-v3.7/index.html?table=A01

4. 新标签打开：
http://127.0.0.1:5500/maison-elan-menu-v3.7/admin.html

5. 使用第三步创建的员工邮箱和密码登录。
6. 顾客页下单。
7. 订单应立即出现在商家订单台。
8. 测试：待接单 → 制作中 → 待上菜 → 已完成。

## 六、测试真正的不同设备

Live Server 只适合本机测试。要让手机和电脑真正跨设备：

1. 把整个 V3.6 文件夹部署到 Vercel。
2. 电脑打开：
   https://你的网址/admin.html
3. 手机打开：
   https://你的网址/?table=A01
4. 手机下单后，电脑订单台应实时出现订单。

## 七、每张桌子的二维码链接

A01桌：https://你的网址/?table=A01
A02桌：https://你的网址/?table=A02
A03桌：https://你的网址/?table=A03
包厢1：https://你的网址/?table=包厢1

正式网址确定后，再批量生成每张桌子的二维码。

## 八、常见问题

1. 顾客下单提示发送失败
- 检查 supabase-config-v36.js 的 URL 和 key 是否完整。
- 检查 SQL 是否整段执行成功。
- 浏览器按 F12 → Console 查看报错。

2. 员工登录成功但订单为空/提示权限错误
- 登录邮箱必须与 staff_emails 白名单完全一致。
- 可在 SQL Editor 执行：
  select * from public.staff_emails;
- 确认订单台使用的账号邮箱在结果里。

3. 订单能刷新出来，但不能实时出现
- 检查 orders 表是否加入 supabase_realtime publication。
- 重新执行 supabase-setup-v36.sql 不会重复创建数据表。
- 即使 Realtime 临时断开，订单台每15秒也会自动刷新一次。

4. 不配置 Supabase 能否继续测试
- 可以。V3.6 会自动进入 LOCAL DEMO 本机模式，功能与 V3.5 相同。

## 当前版本边界

V3.6 已实现真实跨设备订单同步和员工登录保护。
但菜品和价格仍来自顾客网页代码，熟悉开发工具的人理论上可篡改提交金额。
作为作品集和餐厅演示已经足够；正式商业上线前，后续应把菜单放进数据库，并由数据库重新计算订单价格。
