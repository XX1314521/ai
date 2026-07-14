import { create } from "zustand";

export type GenerationWorkbench = "image" | "commerce" | "video";
export type GenerationJobStatus = "running" | "success" | "failed";

export type GenerationJob = {
    id: string;
    workbench: GenerationWorkbench;
    label: string;
    status: GenerationJobStatus;
    createdAt: number;
    updatedAt: number;
    progress: number;
    total: number;
    message?: string;
    error?: string;
    payload?: unknown;
};

type GenerationStore = {
    jobs: GenerationJob[];
    upsertJob: (job: Omit<GenerationJob, "updatedAt"> & { updatedAt?: number }) => void;
    updateJob: (id: string, patch: Partial<Omit<GenerationJob, "id" | "createdAt">>) => void;
    removeJob: (id: string) => void;
    clearCompleted: (workbench?: GenerationWorkbench) => void;
};

export const useGenerationStore = create<GenerationStore>()((set) => ({
    jobs: [],
    upsertJob: (job) =>
        set((state) => {
            const next = { ...job, updatedAt: job.updatedAt || Date.now() };
            const index = state.jobs.findIndex((item) => item.id === job.id);
            if (index < 0) return { jobs: [next, ...state.jobs].slice(0, 60) };
            const jobs = [...state.jobs];
            jobs[index] = { ...jobs[index], ...next };
            return { jobs };
        }),
    updateJob: (id, patch) =>
        set((state) => ({
            jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch, updatedAt: Date.now() } : job)),
        })),
    removeJob: (id) => set((state) => ({ jobs: state.jobs.filter((job) => job.id !== id) })),
    clearCompleted: (workbench) => set((state) => ({ jobs: state.jobs.filter((job) => job.status === "running" || (workbench && job.workbench !== workbench)) })),
}));

