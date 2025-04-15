### 基于EnkaZZZ API的ZZZ-Plugin的外置handler服务端  
### 原理  
在MYS API更新ZZZ面板报错时候，作为Handler处理报错，转发请求到本服务端，本服务端通过EnkaZZZ API获取数据并尝试对其MYS数据字段以期达到面板更新纸目的。  

### 使用方法
1. 在你的handler.js中，请求目标url修改为为你部署此服务端的地址（e.g ip+端口） 
2.安装本项目依赖并运行  
```bash
pnpm i && node .
```
### 免责声明  
使用此服务端后ZZZ插件处仍然需要扫码登录，本handler服务端仅在Mys报错后生效；亦不保证不与其它Handler冲突，介意请慎用。
