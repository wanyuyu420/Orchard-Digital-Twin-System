# 1. 拉框空间诊断接口：接收坐标 $\rightarrow$ 范围检索 $\rightarrow$ 看板指标现场掐算 $\rightarrow$ 返回 JSON。
# 2. TIF上传解译接口：接收TIF $\rightarrow$ 扣留空间参考 $\rightarrow$ 原图滑动窗口切片喂给大模型 $\rightarrow$ 
# 后端 Area 和紧凑度清洗杂质 $\rightarrow$ 批量写入 PostgreSQL 数据库 $\rightarrow$ 返回 JSON 落图。