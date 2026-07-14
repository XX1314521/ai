import { createBrowserRouter, createHashRouter, Outlet } from "react-router-dom";

import UserLayout from "@/layouts/user-layout";
import AssetsPage from "@/pages/assets";
import CanvasPage from "@/pages/canvas";
import CanvasProjectPage from "@/pages/canvas/project";
import CommercePage from "@/pages/commerce";
import ConfigPage from "@/pages/config";
import HomePage from "@/pages/home";
import ImagePage from "@/pages/image";
import NotFound from "@/pages/not-found";
import PromptsPage from "@/pages/prompts";
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
            { path: "/image", element: <ImagePage /> },
            { path: "/commerce", element: <CommercePage /> },
            { path: "/video", element: <VideoPage /> },
            { path: "/assets", element: <AssetsPage /> },
            { path: "/showcase", element: <ShowcasePage /> },
            { path: "/prompts", element: <PromptsPage /> },
            { path: "/canvas", element: <CanvasPage /> },
            { path: "/canvas/:id", element: <CanvasProjectPage /> },
            { path: "/config", element: <ConfigPage /> },
        ],
    },
    { path: "*", element: <NotFound /> },
];

// Electron loads the app from file://, so hash routing keeps deep links
// working after restarting the desktop application.
export const router = window.location.protocol === "file:" ? createHashRouter(routes) : createBrowserRouter(routes);
