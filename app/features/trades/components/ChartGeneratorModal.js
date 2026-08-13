'use client';

import React from 'react';
import HiddenChartGenerator from '@/components/HiddenChartGenerator';
import { useDashboardStore } from '@/app/features/dashboard/store/dashboardStore';

export default function ChartGeneratorModal() {
  const tradeToGenerateImage = useDashboardStore(state => state.tradeToGenerateImage);
  const setTradeToGenerateImage = useDashboardStore(state => state.setTradeToGenerateImage);
  const fetchDashboardData = useDashboardStore(state => state.fetchDashboardData);
  const activeTab = useDashboardStore(state => state.activeTab);

  if (!tradeToGenerateImage) return null;

  let existingImageCount = 0;
  try {
    if (tradeToGenerateImage.image_url) {
      const parsed = JSON.parse(tradeToGenerateImage.image_url);
      existingImageCount = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch (e) {}

  return (
    <HiddenChartGenerator 
      trade={tradeToGenerateImage}
      existingImageCount={existingImageCount}
      isBackground={false}
      onComplete={async (urls, error) => {
        if (urls && urls.length > 0) {
          try {
            let existingImages = [];
            try {
              if (tradeToGenerateImage.image_url) {
                const parsed = JSON.parse(tradeToGenerateImage.image_url);
                existingImages = Array.isArray(parsed) ? parsed : [];
              }
            } catch(e) {}
            
            const combinedUrls = [...existingImages, ...urls];
            
            const res = await fetch('/api/trades', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: tradeToGenerateImage.id, image_url: JSON.stringify(combinedUrls) })
            });
            if (res.ok) {
               fetchDashboardData(activeTab);
            }
          } catch (e) {
            console.error(e);
          }
        } else if (error) {
          console.error('Failed to generate image:', error);
        }
        setTradeToGenerateImage(null);
      }}
      onClose={() => setTradeToGenerateImage(null)}
    />
  );
}
