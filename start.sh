#!/bin/sh

# 啟動 Node.js 應用程式並將其放在背景執行
node index.js &

# 啟動 Apache 伺服器並將其保持在前景執行
# 這樣可以讓 Docker container 保持運行
apache2ctl -D FOREGROUND
