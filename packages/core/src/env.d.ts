// Environnement minimal commun au navigateur, à Node ≥ 18 et à React Native :
// seul `fetch` est utilisé par le cœur (aucune autre API de plateforme).
declare function fetch(input: string): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
