import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET: Lấy tất cả rules (lọc theo account_type nếu có)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ALL';
    const db = await getDb();

    let rules;
    if (type && type !== 'ALL') {
      rules = await db.all(
        "SELECT * FROM user_rules WHERE account_type = 'ALL' OR account_type IS NULL OR account_type = ? ORDER BY created_at DESC",
        [type]
      );
    } else {
      rules = await db.all('SELECT * FROM user_rules ORDER BY created_at DESC');
    }
    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error('Error fetching rules:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Tạo rule mới
export async function POST(request) {
  try {
    const { rule_text, rule_type, rule_value, account_type } = await request.json();

    if (!rule_text || !rule_type) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin rule.' }, { status: 400 });
    }

    const db = await getDb();
    const targetAccount = account_type || 'ALL';
    const result = await db.run(
      'INSERT INTO user_rules (rule_text, rule_type, rule_value, account_type, is_active) VALUES (?, ?, ?, ?, 1)',
      [rule_text, rule_type, rule_value ?? null, targetAccount]
    );
    const newRule = await db.get('SELECT * FROM user_rules WHERE id = ?', [result.lastID]);
    return NextResponse.json({ success: true, data: newRule });
  } catch (error) {
    console.error('Error creating rule:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Xóa rule (id qua query param)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu id.' }, { status: 400 });
    const db = await getDb();
    await db.run('DELETE FROM user_rules WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting rule:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Toggle is_active
export async function PATCH(request) {
  try {
    const { id, is_active } = await request.json();
    const db = await getDb();
    await db.run('UPDATE user_rules SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling rule:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
