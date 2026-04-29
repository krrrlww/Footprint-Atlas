import type { TravelAlbum } from "./types/album";

export const sampleAlbum: TravelAlbum = {
  mode: "all-places",
  title: "FOOTPRINT ATLAS",
  subtitle: "把这些年去过的地方做成一张持续生长的照片地图",
  destination: "ALL PLACES",
  dateRange: "PHOTO ARCHIVE",
  generatedAt: new Date().toISOString(),
  stats: {
    photos: 0,
    geotagged: 0,
    days: 0,
    stops: 0,
    years: 0,
    unplaced: 0
  },
  days: [
    {
      id: "sample-period-01",
      dayKey: "2026-01",
      dateLabel: "2026.01",
      weekday: "ARCHIVE",
      title: "2026 · 01 FOOTPRINTS",
      subtitle: "Sample Places · Replace With Your Photos",
      summary: "这是占位示例。导入照片后，这里会变成按月份整理的足迹地图，而不是单次旅行路线。",
      photoCount: 0,
      stops: [
        {
          id: "sample-stop-01",
          dayKey: "2026-01",
          index: 0,
          title: "Visited Place 01",
          subtitle: "等待导入照片",
          type: "sight",
          time: "10:05",
          startAt: null,
          endAt: null,
          latitude: null,
          longitude: null,
          description: "照片导入后，相册会把相近时间和地点的照片整理成足迹点。",
          photos: []
        },
        {
          id: "sample-stop-02",
          dayKey: "2026-01",
          index: 1,
          title: "Footprint Cluster 02",
          subtitle: "胶片条预览",
          type: "walk",
          time: "13:20",
          startAt: null,
          endAt: null,
          latitude: null,
          longitude: null,
          description: "每个节点会显示照片胶片、拍摄时间、照片数量和 GPS 置信信息。",
          photos: []
        },
        {
          id: "sample-stop-03",
          dayKey: "2026-01",
          index: 2,
          title: "Memory Place 03",
          subtitle: "点击地图图钉打开详情",
          type: "memory",
          time: "18:45",
          startAt: null,
          endAt: null,
          latitude: null,
          longitude: null,
          description: "没有 GPS 的照片也会被保留在时间线中，后续可以人工补地点。",
          photos: []
        }
      ]
    }
  ],
  unplacedPhotos: []
};
