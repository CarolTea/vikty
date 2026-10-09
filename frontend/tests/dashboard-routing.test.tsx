import { it } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Route as DashboardRoute } from "../src/routes/_authenticated/dashboard";

it("dashboard renders its thesis child instead of mounting the list and its save effects", async () => {
  const root = createRootRoute({ component: Outlet });
  const dashboard = DashboardRoute.update({
    id: "/dashboard",
    path: "/dashboard",
    getParentRoute: () => root,
  } as never);
  const detail = createRoute({
    getParentRoute: () => dashboard,
    path: "thesis/$id",
    component: () => {
      const { id } = detail.useParams();
      return <article>Saved thesis {id}</article>;
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([dashboard.addChildren([detail])]),
    history: createMemoryHistory({ initialEntries: ["/dashboard/thesis/first"] }),
  });
  await router.load();
  const first = renderToString(<RouterProvider router={router} />);
  assert.ok(first.includes("Saved thesis"), first);
  assert.ok(first.includes("first"), first);
  assert.ok(!first.includes("My theses"));
});
