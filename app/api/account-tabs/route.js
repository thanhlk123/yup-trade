import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const db = await getDb();
    const tabs = await db.all('SELECT * FROM account_tabs ORDER BY display_order ASC, id ASC');
    
    // If table is empty, insert default tabs
    if (!tabs || tabs.length === 0) {
      const defaultTabs = [
        { key: 'LIVE', label: 'Live Account', color: 'emerald', isAll: 0, order: 0 },
        { key: 'BACKTEST', label: 'Backtest', color: 'blue', isAll: 0, order: 1 },
        { key: 'ALL', label: 'Tất Cả Lệnh', color: 'slate', isAll: 1, order: 2 }
      ];
      
      for (const tab of defaultTabs) {
        await db.run(
          `INSERT INTO account_tabs (tab_key, label, color, is_all, display_order)
           VALUES (?, ?, ?, ?, ?)`,
          [tab.key, tab.label, tab.color, tab.isAll, tab.order]
        );
      }
      
      const newTabs = await db.all('SELECT * FROM account_tabs ORDER BY display_order ASC, id ASC');
      return NextResponse.json({ success: true, data: newTabs });
    }
    
    return NextResponse.json({ success: true, data: tabs });
  } catch (error) {
    console.error('Error fetching account tabs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch account tabs' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { key, label, color, isAll, display_order } = data;
    
    if (!key || !label) {
      return NextResponse.json({ success: false, error: 'Key and label are required' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Check if key already exists
    const existing = await db.get('SELECT id FROM account_tabs WHERE tab_key = ?', [key]);
    if (existing) {
      return NextResponse.json({ success: false, error: 'Tab key already exists' }, { status: 400 });
    }

    const order = display_order !== undefined ? display_order : 99;
    
    const result = await db.run(
      `INSERT INTO account_tabs (tab_key, label, color, is_all, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [key, label, color || 'emerald', isAll ? 1 : 0, order]
    );
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: result.lastID,
        tab_key: key,
        label,
        color: color || 'emerald',
        is_all: isAll ? 1 : 0,
        display_order: order
      }
    });
  } catch (error) {
    console.error('Error adding account tab:', error);
    return NextResponse.json({ success: false, error: 'Failed to add account tab' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const db = await getDb();
    
    // Check if data is an array (bulk update for reordering)
    if (Array.isArray(data)) {
      // Begin a transaction equivalent (sqlite allows running multiple sequentially)
      for (const tab of data) {
        if (!tab.tab_key || tab.display_order === undefined) continue;
        await db.run(
          `UPDATE account_tabs SET display_order = ? WHERE tab_key = ?`,
          [tab.display_order, tab.tab_key]
        );
      }
      return NextResponse.json({ success: true });
    }

    // Single update
    const { tab_key, label, color, display_order } = data;
    
    if (!tab_key) {
      return NextResponse.json({ success: false, error: 'Tab key is required' }, { status: 400 });
    }
    
    const updates = [];
    const values = [];
    
    if (label !== undefined) {
      updates.push('label = ?');
      values.push(label);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(display_order);
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }
    
    values.push(tab_key);
    
    await db.run(
      `UPDATE account_tabs SET ${updates.join(', ')} WHERE tab_key = ?`,
      values
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating account tab:', error);
    return NextResponse.json({ success: false, error: 'Failed to update account tab' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab_key = searchParams.get('key');
    
    if (!tab_key) {
      return NextResponse.json({ success: false, error: 'Tab key is required' }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Prevent deleting 'is_all' tab
    const tab = await db.get('SELECT is_all FROM account_tabs WHERE tab_key = ?', [tab_key]);
    if (tab && tab.is_all === 1) {
      return NextResponse.json({ success: false, error: 'Cannot delete the All Trades tab' }, { status: 403 });
    }
    
    // Find all trades associated with this tab
    const tradesToDelete = await db.all('SELECT id, image_url FROM trades WHERE trade_type = ?', [tab_key]);
    const deletedTradeIds = [];
    
    // Delete associated images
    for (const trade of tradesToDelete) {
      deletedTradeIds.push(trade.id);
      if (trade.image_url) {
        try {
          const urls = trade.image_url.split(',').map(url => url.trim()).filter(Boolean);
          for (const url of urls) {
            if (url.startsWith('/uploads/charts/')) {
              const filename = url.replace('/uploads/charts/', '');
              const filePath = path.join(process.cwd(), 'public', 'uploads', 'charts', filename);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            }
          }
        } catch (err) {
          console.error('Error deleting image for trade', trade.id, err);
        }
      }
    }
    
    // Delete trades from DB
    await db.run('DELETE FROM trades WHERE trade_type = ?', [tab_key]);
    
    await db.run('DELETE FROM account_tabs WHERE tab_key = ?', [tab_key]);
    
    return NextResponse.json({ success: true, deletedTradeIds });
  } catch (error) {
    console.error('Error deleting account tab:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete account tab' }, { status: 500 });
  }
}
