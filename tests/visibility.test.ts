import { describe, expect, it } from 'vitest';
import { Group, Mesh, Vector3 } from 'three';
import { interactionObjects, suspendHiddenUpdates } from '../src/scene/visibility';

describe('suspended zones', () => {
  it('skips hidden matrix traversal and refreshes transforms when returning', () => {
    const zone = new Group(), child = new Group(); zone.add(child);
    let visits = 0;
    const update = child.updateMatrixWorld;
    child.updateMatrixWorld = function (force) { visits++; update.call(this, force); };
    suspendHiddenUpdates(zone);
    zone.visible = false; zone.position.x = 10; child.position.x = 2;
    zone.updateMatrixWorld(true);
    expect(visits).toBe(0);
    zone.visible = true; zone.updateMatrixWorld(true);
    expect(visits).toBe(1);
    expect(new Vector3().setFromMatrixPosition(child.matrixWorld).x).toBe(12);
  });
  it('keeps invisible interaction hits and opaque occluders, excluding hidden zones', () => {
    const scene = new Group(), hiddenZone = new Group(), terminal = new Mesh(), wall = new Mesh();
    hiddenZone.visible = false; hiddenZone.add(new Mesh());
    terminal.visible = false; terminal.userData.interact = 'terminal';
    const decoration = new Mesh(); decoration.visible = false;
    scene.add(hiddenZone, terminal, wall, decoration);
    const targets: Mesh[] = [];
    interactionObjects(scene, targets);
    expect(targets).toEqual([terminal, wall]);
    hiddenZone.visible = true; targets.length = 0; interactionObjects(scene, targets);
    expect(targets).toHaveLength(3);
  });
});
