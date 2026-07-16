import { createBrowserRouter, createHashRouter, Navigate, Outlet } from "react-router-dom";

import UserLayout from "@/layouts/user-layout";
import { RequireAuth } from "@/components/auth/require-auth";
import AdminPage from "@/pages/admin";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import ComicPage from "@/pages/comic";
import CommercePage from "@/pages/commerce";
import ConfigPage from "@/pages/config";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
import ProfilePage from "@/pages/profile";
import ShowcasePage from "@/pages/showcase";
import VideoPage from "@/pages/video";

const routes = [
    {
        element: (
            <UserLayout>
                <Outlet />
            </UserLayout>
        ),
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/image", element: <RequireAuth><ImagePage /></RequireAuth> },
            { path: "/commerce", element: <RequireAuth><CommercePage /></RequireAuth> },
            { path: "/comic", element: <RequireAuth><ComicPage /></RequireAuth> },
            { path: "/video", element: <RequireAuth><VideoPage /></RequireAuth> },
            { path: "/assets", element: <RequireAuth><Navigate to="/profile?section=assets" replace /></RequireAuth> },
            { path: "/showcase", element: <ShowcasePage /> },
            { path: "/prompts", element: <RequireAuth><PromptsPage /></RequireAuth> },
            { path: "/canvas", element: <RequireAuth><CanvasPage /></RequireAuth> },
            { path: "/canvas/:id", element: <RequireAuth><CanvasProjectPage /></RequireAuth> },
            { path: "/config", element: <RequireAuth><ConfigPage /></RequireAuth> },
            { path: "/profile", element: <RequireAuth><ProfilePage /></RequireAuth> },
            { path: "/account", element: <RequireAuth><Navigate to="/profile?section=account" replace /></RequireAuth> },
            { path: "/admin", element: <RequireAuth admin><AdminPage /></RequireAuth> },
        ],
    },
    { path: "/login", element: <LoginPage /> },
    { path: "*", element: <NotFound /> },
];

// Electron loads the app from file://, so hash routing keeps deep links
// working after restarting the desktop application.
export const router = window.location.protocol === "file:" ? createHashRouter(routes) : createBrowserRouter(routes);
