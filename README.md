# Footprint Atlas

Footprint Atlas 是一个个人足迹地图生成器：把带有 EXIF 信息的旅行照片放进项目，它会自动提取拍摄时间和 GPS，把你这些年去过的地方整理成一张复古手账风格的互动地图。

它不是“单次旅行路线”工具，而是一个持续生长的「去过的地方」档案。适合用来整理手机相册、旅行照片、城市漫游记录，以及那些散落在硬盘里的记忆碎片。

## Features

- 从照片 EXIF 中提取拍摄时间、GPS、尺寸等元数据
- 按月份、时间间隔和地理距离自动聚合足迹点
- 使用真实世界地图数据和 `d3-geo` 投影足迹坐标
- 生成复古牛皮纸地图、红色时间虚线、照片图钉和胶片式详情页
- 未获取到 GPS 的照片默认不显示在地图上，可在页面里补地点和拍摄时间
- 地点可自动转经纬度，也支持手动输入坐标
- 支持在本地页面中手动上传照片，上传后自动重新生成地图
- 生成静态前端资源，适合部署到 GitHub Pages、Vercel 或 Cloudflare Pages

## Preview

当前界面风格参考旅行手账和复古地图：

- 牛皮纸与细点纹理
- 真实地图轮廓的手账化渲染
- 红色虚线表示照片时间顺序
- 照片图钉堆叠显示足迹点
- 地图支持放大、缩小、拖拽平移、重置，以及聚焦当前时期
- 密集点位会自动聚合成足迹簇，点击足迹簇会继续放大聚焦
- 桌面端采用全屏应用式布局，地图和归档面板会填满剩余窗口空间
- 窄屏设备会切换为上下布局，页面自然滚动
- 右侧按时期归档
- 点击足迹点打开纸张式 Archive Log
- 照片以黑色胶片条展示

## Quick Start

安装依赖：

```bash
npm install
```

把照片放入：

```text
raw/photos/
```

也可以启动开发服务后，在页面里点击「上传照片」选择或拖入图片。网页上传会把图片保存到 `raw/photos/` 并自动刷新足迹数据。

生成足迹数据：

```bash
npm run album:build
```

启动本地开发服务：

```bash
npm run dev
```

打开：

```text
http://localhost:5173/
```

## Scripts

```bash
npm run album:build
```

读取 `raw/photos/`，生成 `data/album.json`、`data/media.json` 和 `public/album.json`。

```bash
npm run dev
```

启动 Vite 开发服务。开发模式下会额外提供本地 API，用于保存手动补充的地点和时间。

```bash
npm run build
```

构建可部署的静态网页到 `dist/`。

```bash
npm run test
```

运行单元测试。

```bash
npm run album:reset
```

清空已生成的相册数据和媒体文件，不会删除 `raw/photos/` 里的原始照片。

## How It Works

数据会被整理成以下层级：

```text
Atlas
  Period
    Footprint Stop
      Photo
```

`Period` 表示一个月份或时期，`Footprint Stop` 表示该时期内相近时间或相近地点的一组照片。

当前聚合规则：

- 同一月份内超过约 6 小时会拆成新足迹点
- GPS 距离超过约 12 km 会拆成新足迹点
- 同一组照片过多时，会根据时间间隔继续拆分

地图上的红色虚线表示照片的时间顺序，不表示一次连续旅行。

## Fix Missing Locations

没有 GPS 的照片不会显示在地图和归档中，而是进入「补充未定位照片」工作台。

在工作台里可以：

- 输入地点并搜索
- 选择搜索结果后自动填入经纬度
- 手动输入经纬度作为兜底
- 修改或补充拍摄时间
- 保存到 `data/manual-overrides.json`
- 自动重新生成 `public/album.json`

地点搜索优先使用内置地点库和 Open-Meteo 地理编码服务。网络不可用或搜索不到时，可以直接填写坐标。

## Upload Photos From The UI

开发模式下可以在页面中点击「上传照片」：

- 支持多选和拖拽
- 支持 JPG、PNG、WebP、HEIC、HEIF、TIFF
- 上传后保存到 `raw/photos/`
- 上传成功后自动运行数据生成脚本
- 前端会立即使用新的 `album.json`

这个模块依赖 Vite 本地开发服务提供的 `/api/upload-photos` 接口。构建后的纯静态站点不能直接写入本地文件，因此静态部署版本不包含真正的上传后端。

## Project Structure

```text
footprint-atlas/
  raw/photos/              Original photos
  data/                    Generated JSON and manual overrides
  public/album.json        Atlas data consumed by the frontend
  public/media/            Optimized images and thumbnails
  scripts/ingest-photos.mjs
  src/
    components/            Map, pins, archive modal, missing-location editor
    lib/                   Geo helpers, map projection, album helpers
    styles/app.css         Vintage atlas styling
    types/album.ts         Shared data types
```

## Privacy

Footprint Atlas is designed as a local-first project.

- 原始照片保存在本地 `raw/photos/`
- 生成后的网页图片会写入 `public/media/`
- EXIF 信息会整理到本地 JSON 文件
- 手动补充的地点和时间保存在 `data/manual-overrides.json`
- 地点搜索会调用在线地理编码服务；不想联网时可以手动输入经纬度

部署前建议检查 `public/media/` 和 `public/album.json`，确认没有不想公开的照片或坐标。

## Tech Stack

- React
- Vite
- TypeScript
- `exiftool-vendored`
- `sharp`
- `d3-geo`
- `world-atlas`
- `topojson-client`

## Roadmap

- 支持多种地图主题
- 支持手动合并和拆分足迹点
- 支持导出隐私模式，模糊精确坐标
- 支持接入视觉模型，为足迹点自动生成标题和描述
- 支持 GitHub Pages 部署脚本

## License

MIT
