import React, { useState, useEffect } from 'react';
import HiddenChartGenerator from './HiddenChartGenerator';

export default function AutoChartGeneratorWorker({ trades, onTradeUpdated }) {
  const [targetTrade, setTargetTrade] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [failedTradeIds, setFailedTradeIds] = useState(new Set());

  useEffect(() => {
    if (isProcessing || !trades || trades.length === 0) return;

    // Find the first trade that has no images and hasn't failed in this session
    const pendingTrade = trades.find(trade => {
      if (failedTradeIds.has(trade.id)) return false;
      
      if (!trade.image_url) return true;
      try {
        const parsed = JSON.parse(trade.image_url);
        if (Array.isArray(parsed) && parsed.length === 0) return true;
      } catch (e) {
        if (trade.image_url === '[]' || trade.image_url.trim() === '') return true;
      }
      return false;
    });

    if (pendingTrade && (!targetTrade || targetTrade.id !== pendingTrade.id)) {
      console.log(`[AutoChartWorker] Starting background generation for trade ${pendingTrade.id}`);
      setTargetTrade(pendingTrade);
      setIsProcessing(true);
    }
  }, [trades, isProcessing, targetTrade, failedTradeIds]);

  if (!targetTrade) return null;

  return (
    <HiddenChartGenerator
      trade={targetTrade}
      isBackground={true}
      onComplete={async (urls, error) => {
        if (urls && urls.length > 0) {
          try {
            // New auto-generated URLs
            const newImagesList = [...urls];
            
            // Update trade in DB
            const res = await fetch('/api/trades', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: targetTrade.id, image_url: JSON.stringify(newImagesList) })
            });
            if (!res.ok) {
               const errData = await res.json();
               throw new Error(errData.error || 'Failed to update trade in DB');
            }
            console.log(`[AutoChartWorker] Successfully generated images for trade ${targetTrade.id}`);
          } catch (err) {
            console.error(`[AutoChartWorker] Error saving for trade ${targetTrade.id}`, err);
            setFailedTradeIds(prev => new Set(prev).add(targetTrade.id));
          }
        } else {
          console.warn(`[AutoChartWorker] Failed to generate for trade ${targetTrade.id}: ${error}`);
          setFailedTradeIds(prev => new Set(prev).add(targetTrade.id));
        }
        
        setTargetTrade(null);
        // Wait 3 seconds before processing the next one to avoid hammering the API
        setTimeout(() => {
          setIsProcessing(false);
          if (onTradeUpdated) onTradeUpdated();
        }, 3000);
      }}
    />
  );
}
