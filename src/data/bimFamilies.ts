
export interface BIMFamily {
  id: string;
  name: string;
  description: string;
  defaultColor: string;
  category: 'struttura' | 'architettura' | 'impianti' | 'finiture' | 'esterno';
}

export const BIM_FAMILIES: BIMFamily[] = [
  { id: 'fondazioni', name: 'Fondazioni', description: 'Plinti, travi rovesce, platee', defaultColor: '#4b5563', category: 'struttura' },
  { id: 'pilastri_ca', name: 'Strutture in C.A.', description: 'Pilastri e travi in cemento armato', defaultColor: '#6b7280', category: 'struttura' },
  { id: 'massetti', name: 'Massetti', description: 'Massetti di sottofondo e pendenze', defaultColor: '#9ca3af', category: 'finiture' },
  { id: 'murature_portanti', name: 'Murature Portanti', description: 'Muri maestri in mattoni o blocchi', defaultColor: '#b91c1c', category: 'architettura' },
  { id: 'tramezzature', name: 'Tramezzature', description: 'Pareti divisorie interne in laterizio', defaultColor: '#ef4444', category: 'architettura' },
  { id: 'cartongesso', name: 'Pareti in Cartongesso', description: 'Sistemi a secco e contropareti', defaultColor: '#fbbf24', category: 'architettura' },
  { id: 'intonaco_completo', name: 'Intonaco completo', description: 'Intonaco di fondo e finitura (civile)', defaultColor: '#f3f4f6', category: 'finiture' },
  { id: 'intonaco_rustico', name: 'Intonaco rustico', description: 'Intonaco grezzo a superficie irregolare', defaultColor: '#b0aca8', category: 'finiture' },
  { id: 'pitture', name: 'Opere da Pittore', description: 'Tinteggiature, smalti e decorazioni', defaultColor: '#60a5fa', category: 'finiture' },
  { id: 'rivestimenti', name: 'Rivestimenti', description: 'Piastrelle ceramiche e pietre a parete', defaultColor: '#34d399', category: 'finiture' },
  { id: 'pavimenti', name: 'Pavimenti', description: 'Gres, parquet, marmi e resine', defaultColor: '#d97706', category: 'finiture' },
  { id: 'impermeabilizzazioni', name: 'Impermeabilizzazioni', description: 'Guaine e trattamenti anti-umidità', defaultColor: '#1e3a8a', category: 'struttura' },
  { id: 'isolamenti_termici', name: 'Isolamenti Termici', description: 'Cappotti e pannelli isolanti', defaultColor: '#10b981', category: 'architettura' },
  { id: 'serramenti_esterni', name: 'Serramenti Esterni', description: 'Finestre e portafinestre', defaultColor: '#0ea5e9', category: 'architettura' },
  { id: 'porte_interne', name: 'Porte Interne', description: 'Porte a battente, scorrevoli e a scomparsa', defaultColor: '#8b5cf6', category: 'architettura' },
  { id: 'impianto_idrico', name: 'Impianto Idrico-Sanitario', description: 'Tubazioni e scarichi', defaultColor: '#2563eb', category: 'impianti' },
  { id: 'impianto_elettrico', name: 'Impianto Elettrico', description: 'Punti luce, prese e quadri', defaultColor: '#eab308', category: 'impianti' },
  { id: 'termico_clima', name: 'Riscaldamento e Clima', description: 'Radiatori, split e fancoil', defaultColor: '#f97316', category: 'impianti' },
  { id: 'controsoffitti', name: 'Controsoffitti', description: 'Soffittature tecniche e decorative', defaultColor: '#fde047', category: 'architettura' },
  { id: 'scale_parapetti', name: 'Scale e Parapetti', description: 'Strutture di collegamento verticale', defaultColor: '#475569', category: 'architettura' },
  { id: 'arredo_bagno', name: 'Arredo Bagno', description: 'Sanitari e rubinetterie', defaultColor: '#6ee7b7', category: 'architettura' },
  { id: 'solaio_interpiano', name: 'Solaio Interpiano', description: 'Solai in laterocemento o legno', defaultColor: '#1f2937', category: 'struttura' },
  { id: 'coperture', name: 'Coperture', description: 'Tetti a falde o piani', defaultColor: '#065f46', category: 'architettura' },
  { id: 'casseri_ca', name: 'Casseri C.A.', description: 'Casseri per cemento armato con tiranti', defaultColor: '#854d0e', category: 'struttura' },
  { id: 'pavimenti_50x100', name: 'Pavimenti 50x100', description: 'Gres porcellanato formato 50x100 cm', defaultColor: '#92400e', category: 'finiture' },
  { id: 'ponteggio', name: 'Ponteggio', description: 'Ponteggio metallico fisso a telai prefabbricati', defaultColor: '#ea580c', category: 'esterno' },
  { id: 'mantovana', name: 'Mantovana di Sicurezza', description: 'Mantovana di sicurezza in lamiera metallica per ponteggi', defaultColor: '#1e293b', category: 'esterno' }
];
