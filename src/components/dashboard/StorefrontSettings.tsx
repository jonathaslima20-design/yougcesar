import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StorefrontFiltersManager from '@/components/dashboard/StorefrontFiltersManager';
import CategoryDisplaySettings from '@/components/dashboard/CategoryDisplaySettings';

export function StorefrontSettings() {
  const [activeTab, setActiveTab] = useState('filters');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 h-auto gap-1">
          <TabsTrigger value="filters" className="text-xs sm:text-sm py-2 sm:py-2.5">
            Filtros
          </TabsTrigger>
          <TabsTrigger value="organization" className="text-xs sm:text-sm py-2 sm:py-2.5">
            Organização
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filters" className="mt-4 sm:mt-6">
          <StorefrontFiltersManager />
        </TabsContent>

        <TabsContent value="organization" className="mt-4 sm:mt-6">
          <CategoryDisplaySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}