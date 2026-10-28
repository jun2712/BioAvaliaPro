import React from "react";
import AppShell from "@/components/AppShell";
import ExportPanel from "@/components/import-export/ExportPanel";
import ImportPanel from "@/components/import-export/ImportPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ImportExport() {
  return (
    <AppShell
      title="Importar / Exportar"
      subtitle="Clientes, avaliações e anamneses em CSV, vinculados pelo ID interno"
    >
      <Tabs defaultValue="exportar">
        <TabsList>
          <TabsTrigger value="exportar">Exportar</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>
        <TabsContent value="exportar" className="mt-4"><ExportPanel /></TabsContent>
        <TabsContent value="importar" className="mt-4"><ImportPanel /></TabsContent>
      </Tabs>
    </AppShell>
  );
}