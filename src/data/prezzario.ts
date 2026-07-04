export interface PrezzarioItem {
  codice: string;
  descrizione: string;
  unita: string;
  prezzo: number;
  categoria: string;
}

export const PREZZARIO_GECOLA: PrezzarioItem[] = [
  {
    codice: "NP.OP08.015b",
    descrizione: "Massetto autolivellante a base cementizia per interni, tirato in piano, spessore medio 5 cm, idoneo per posa di pavimenti resilienti o ceramici.",
    unita: "mq",
    prezzo: 24.50,
    categoria: "Opere Edili"
  },
  {
    codice: "RM.OP04.012a",
    descrizione: "Tavolato per divisori interni eseguito con blocchi di laterizio forato spessore 12 cm, legati con malta cementizia M5, compreso intonaco strutturale.",
    unita: "mq",
    prezzo: 68.00,
    categoria: "Opere Edili"
  },
  {
    codice: "NP.OP04.015a",
    descrizione: "Intonaco rustico e di finitura tirato in piano con malta bastarda o premiscelata per interni, spessore medio 1.5 cm, eseguito a regola d'arte.",
    unita: "mq",
    prezzo: 22.50,
    categoria: "Finiture"
  },
  {
    codice: "NP.OP05.001",
    descrizione: "Tinteggiatura con idropittura lavabile ad alta copertura per interni, stesa in due mani previa preparazione delle superfici (carteggiatura e isolante).",
    unita: "mq",
    prezzo: 12.00,
    categoria: "Finiture"
  },
  {
    codice: "NP.OP11.022",
    descrizione: "Fornitura e posa in opera di pavimentazione in piastrelle di gres porcellanato di prima scelta, formato standard fino a 60x60 cm, compreso collante.",
    unita: "mq",
    prezzo: 45.00,
    categoria: "Pavimentazioni"
  },
  {
    codice: "NP.OP11.035",
    descrizione: "Fornitura e posa di battiscopa in gres porcellanato o ceramica, coordinato al pavimento, altezza 7-8 cm, compreso sigillatura superiore.",
    unita: "m",
    prezzo: 8.50,
    categoria: "Pavimentazioni"
  },
  {
    codice: "NP.OP09.112",
    descrizione: "Porta per interni in legno tamburato o nobilitato, finitura standard noce o bianca, completa di contro-telaio in abete da 10cm, cerniere e maniglia.",
    unita: "cad",
    prezzo: 380.00,
    categoria: "Infissi"
  },
  {
    codice: "NP.OP09.208",
    descrizione: "Serramento esterno in PVC a 5 camere, triplo vetro basso emissivo con gas Argon, completo di guarnizioni magnetiche classe 4 di permeabilità all'aria.",
    unita: "cad",
    prezzo: 550.00,
    categoria: "Infissi"
  },
  {
    codice: "EE.OP15.004",
    descrizione: "Punto luce o punto di comando interno con scatola porta frutti da incasso tipo BTicino o Vimar, conduttori NO7V-K da 1.5mmq passanti in corrugato.",
    unita: "cad",
    prezzo: 85.00,
    categoria: "Impianti Elettrici"
  },
  {
    codice: "ID.OP16.032",
    descrizione: "Punto acqua adduzione fredda/calda e sistema di scarico completo eseguito con tubazioni multistrato coibentate termicamente.",
    unita: "cad",
    prezzo: 240.00,
    categoria: "Impianti Idraulici"
  },
  {
    codice: "NP.OP01.005",
    descrizione: "Demolizione di murature in mattoni forati o pieni di qualsiasi spessore, compreso cernita, calo in basso e sgombero dei materiali di risulta all'esterno.",
    unita: "mc",
    prezzo: 110.00,
    categoria: "Demolizioni"
  },
  {
    codice: "NP.OP01.012",
    descrizione: "Rimozione di pavimentazione esistente in ceramica, gres, marmette o parquet, compreso il sottostante strato di allettamento fino a 5 cm.",
    unita: "mq",
    prezzo: 18.00,
    categoria: "Demolizioni"
  },
  {
    codice: "NP.OP12.001",
    descrizione: "Controsoffitto piano ad orditura metallica semplice e singola lastra di cartongesso standard spessore 12.5 mm, compreso stuccatura dei giunti.",
    unita: "mq",
    prezzo: 38.00,
    categoria: "Opere a Secco"
  }
];
