<ul>
  <li>二改无限画布</li>
  <li>里面的api地址我是写了固定值的 用于我自己的中转程序</li>
  <li><img width="1912" height="956" alt="image" src="https://github.com/user-attachments/assets/7b5873b0-d0eb-42e3-b883-12a9ebd8f42e" /></li>
  <li>修改的话在\src\stores\use-config-store</li>
  <li>#export const AIKART_BASE_URL = "https://ai.ikui.cn/";</li>
  <li>把地址替换成新的即可，例如：</li>
  <li>export const AIKART_BASE_URL = "https://你的域名/";</li>
  <li>项目的 API 请求会在同文件 buildApiUrl() 中统一使用这个地址。修改后执行：</li>
  <li>power shell</li>
  <li>npm.cmd run build</li>
  <li>如果部署到 Vercel，还需要提交并推送代码，触发重新部署。已有浏览器配置可能保存在本地缓存中，必要时到配置页重新保存一次</li>
</ul>
<li>不懂可以进群交流：1056190813</li>
