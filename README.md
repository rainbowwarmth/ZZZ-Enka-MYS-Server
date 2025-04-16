### 一种基于EnkaZZZ API的Yunzai ZZZ-Plugin面板更新外置handler服务端  
### 原理  
在MYS API更新ZZZ面板报错时候，作为Handler处理报错，转发请求到本服务端，本服务端通过EnkaZZZ API获取数据并尝试对其MYS数据字段以期达到面板更新纸目的。  

### 使用方法
1. 在你的handler.js中，请求目标url修改为为你部署此服务端的地址（e.g ip+端口+路径） 
2.安装本项目依赖并运行  
```bash
pnpm i && node .
```
### 潜在问题与免责声明  
1.使用此服务端后ZZZ插件处仍然需要扫码登录，本handler服务端仅在Mys报错后生效，请确保多个handler存在时**最后**调用本服务端.  
2.不能保证你的handler不与其它handler冲突，介意请慎用，或自行做出修改.  
3.本服务端需要传入用户CK，请自行搭建并避免使用所谓的公共/公益服务端.  
4.如有Bug请通过issues反馈.  

### 致谢  
[ZZZuid](https://github.com/ZZZure/ZZZeroUID)  
[Enka.network](Enka.network)  
[ZZZ-plugin](https://github.com/ZZZure/ZZZ-Plugin)  
