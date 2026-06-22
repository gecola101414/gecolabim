import { Entity } from '../types';
import { mapLegacyDataToBIMObject } from './ifcMapper';
import { saveAs } from 'file-saver';

export function exportEntitiesToIFC(entities: Entity[]) {
  const bimObjects = entities.map(mapLegacyDataToBIMObject).filter(Boolean);
  
  if (bimObjects.length === 0) {
    alert("Nessun elemento BIM trovato da esportare.");
    return;
  }

  const ifcContent = generateIFCContent(bimObjects);
  const blob = new Blob([ifcContent], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, 'export.ifc');
}

function generateIFCContent(bimObjects: any[]): string {
  let header = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('export.ifc','${new Date().toISOString()}',('Author'),('Organization'),'PreProcessorVersion','OriginatingSystem','Authorization');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCPROJECT('0yL_123456789',$,'Progetto BIM',$,$,$,$,($,$),($,$));
`;

  let body = '';
  bimObjects.forEach((obj, index) => {
    const id = index + 2;
    body += `#${id}=${obj.ifc_class.toUpperCase()}('${obj.guid}',$,'${obj.identity.name}',$,$,$,$,$,$);\n`;
  });

  const footer = `ENDSEC;
END-ISO-10303-21;`;

  return header + body + footer;
}
