import type { ReleaseBruto } from "@/lib/discogs/release";

/** Single em vinil, artista homônimo "(2)", imagem primária não é a primeira. */
export const releaseSimples: ReleaseBruto = {
  id: 249504,
  master_id: 96559,
  title: "Never Gonna Give You Up",
  year: 1987,
  uri: "https://www.discogs.com/release/249504-Rick-Astley-Never-Gonna-Give-You-Up",
  thumb: "https://i.discogs.com/thumb-249504.jpg",
  artists: [{ id: 72872, name: "Rick Astley (2)", join: "" }],
  formats: [{ name: "Vinyl", qty: "1", descriptions: ['7"', "45 RPM", "Single"] }],
  images: [
    { type: "secondary", uri: "https://i.discogs.com/secundaria.jpg", uri150: "https://i.discogs.com/sec150.jpg" },
    { type: "primary", uri: "https://i.discogs.com/primaria.jpg", uri150: "https://i.discogs.com/pri150.jpg" },
  ],
  tracklist: [
    { position: "A", type_: "heading", title: "Lado A" },
    { position: "A", type_: "track", title: "Never Gonna Give You Up", duration: "3:32" },
    { position: "B", type_: "track", title: "Never Gonna Give You Up (Instrumental)", duration: "3:30" },
  ],
};

/** Coletânea "Various" com artista por faixa e faixas agrupadas em "index". */
export const releaseVarious: ReleaseBruto = {
  id: 555,
  title: "Now That's What I Call Music",
  year: 0,
  artists: [{ id: 194, name: "Various", join: "" }],
  formats: [{ name: "CD", qty: "2", descriptions: ["Compilation"] }],
  tracklist: [
    { position: "1-1", type_: "track", title: "Faixa Um", artists: [{ id: 1, name: "Banda A" }] },
    {
      position: "1-2",
      type_: "track",
      title: "Faixa Dois",
      artists: [
        { id: 2, name: "Banda B", join: "feat." },
        { id: 3, name: "Cantor C (3)" },
      ],
    },
    {
      position: "2",
      type_: "index",
      title: "Suíte",
      sub_tracks: [
        { position: "2.1", type_: "track", title: "Parte I" },
        { position: "2.2", type_: "track", title: "Parte II" },
      ],
    },
  ],
};

/** Box com CD e DVD, e dois artistas ligados por "&". */
export const releaseCdDvd: ReleaseBruto = {
  id: 777,
  master_id: 0,
  title: "Ao Vivo",
  artists: [
    { id: 10, name: "Dupla X", join: "&" },
    { id: 11, name: "Dupla Y" },
  ],
  formats: [{ name: "Box Set" }, { name: "CD", qty: "1" }, { name: "DVD", qty: "1" }],
  tracklist: [{ position: "1", type_: "track", title: "Abertura" }],
};
