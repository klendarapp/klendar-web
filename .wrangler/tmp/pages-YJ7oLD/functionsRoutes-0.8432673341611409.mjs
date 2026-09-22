import { onRequestGet as __b__id__js_onRequestGet } from "C:\\Users\\Pc\\Documents\\klendar-web\\functions\\b\\[id].js"
import { onRequestGet as __o__id__js_onRequestGet } from "C:\\Users\\Pc\\Documents\\klendar-web\\functions\\o\\[id].js"

export const routes = [
    {
      routePath: "/b/:id",
      mountPath: "/b",
      method: "GET",
      middlewares: [],
      modules: [__b__id__js_onRequestGet],
    },
  {
      routePath: "/o/:id",
      mountPath: "/o",
      method: "GET",
      middlewares: [],
      modules: [__o__id__js_onRequestGet],
    },
  ]