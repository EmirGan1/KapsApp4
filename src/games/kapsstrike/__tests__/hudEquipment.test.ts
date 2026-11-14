import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTouchCombatButtonState,
  getTopRightEquipmentSlots,
  getReadOnlyInventoryContents,
} from '../hudEquipment.ts';

test('getTouchCombatButtonState shows attack button and hides grenade throw buttons when holding a gun or knife', () => {
  const state = getTouchCombatButtonState({ weapon: 'rifle', ammo: 30, capacity: 30 });
  assert.equal(state.mode, 'weapon_attack');
  assert.equal(state.showAttackButton, true);
  assert.equal(state.showGrenadeThrowButtons, false);
});

test('getTouchCombatButtonState hides attack button and shows only near/far throw buttons when holding a grenade', () => {
  for (const kind of ['frag', 'flash', 'smoke'] as const) {
    const state = getTouchCombatButtonState({
      weapon: 'rifle',
      utilityEquipped: kind,
      utilityInventory: { frag: 1, flash: 2, smoke: 1 },
    });
    assert.equal(state.mode, 'grenade_throw');
    assert.equal(state.showAttackButton, false);
    assert.equal(state.showGrenadeThrowButtons, true);
    assert.equal(state.activeGrenade, kind);
    assert.ok((state.activeGrenadeName || '').length > 0);
  }
});

test('getTopRightEquipmentSlots lists weapons, available grenades, and C4 slot accurately', () => {
  const res = getTopRightEquipmentSlots({
    weapon: 'rifle',
    ammo: 30,
    capacity: 30,
    inventory: ['rifle', 'pistol', 'knife'],
    utilityInventory: { frag: 1, flash: 2, smoke: 0 },
    isBombCarrier: true,
    bombEquipped: false,
  });

  assert.equal(res.activeSummary.isGrenade, false);
  assert.equal(res.activeSummary.isBomb, false);
  assert.equal(res.weapons.length, 3);
  assert.equal(res.weapons[0].active, true);
  assert.deepEqual(
    res.grenades.map((g) => g.id),
    ['flash', 'frag']
  );
  assert.ok(res.bombSlot);
  assert.equal(res.bombSlot?.id, 'c4');
});

test('getTopRightEquipmentSlots highlights equipped grenade in activeSummary', () => {
  const res = getTopRightEquipmentSlots({
    weapon: 'rifle',
    inventory: ['rifle', 'pistol', 'knife'],
    utilityEquipped: 'flash',
    utilityInventory: { frag: 1, flash: 2, smoke: 1 },
  });

  assert.equal(res.activeSummary.isGrenade, true);
  assert.equal(res.grenades.find((g) => g.id === 'flash')?.active, true);
  assert.equal(res.weapons.every((w) => !w.active), true);
});

test('getReadOnlyInventoryContents returns read-only inventory state without action mutations', () => {
  const readout = getReadOnlyInventoryContents({
    weapons: ['rifle', 'pistol', 'knife'],
    utility: { frag: 1, flash: 0, smoke: 2 },
    armor: 100,
    kit: true,
    isCarrier: true,
  });

  assert.equal(readout.weaponNames.length, 3);
  assert.equal(readout.grenadeItems.length, 2);
  assert.equal(readout.grenadeItems.find((g) => g.kind === 'smoke')?.count, 2);
  assert.ok(readout.equipmentTags.includes('Zırh +100'));
  assert.ok(readout.equipmentTags.includes('Çözme Kiti'));
  assert.ok(readout.equipmentTags.includes('C4 Taşıyıcı'));
});
