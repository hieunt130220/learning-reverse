/**
 * Danh mục action farm hiển thị trên UI.
 * `args` khớp đúng chữ ký method trong server/src/game/farmService.ts.
 */
export interface ActionArg {
  name: string;
  label: string;
  default: number;
}

export interface ActionDef {
  action: string;
  label: string;
  group: string;
  args: ActionArg[];
  hint?: string;
}

const cell = (name = 'indexCell'): ActionArg => ({ name, label: 'ô đất', default: 0 });
const user = (): ActionArg => ({ name: 'idUser', label: 'id nhân vật', default: 0 });

export const ACTIONS: ActionDef[] = [
  { action: 'joinFarm', label: 'Vào nông trại', group: 'Cơ bản', args: [user()] },
  { action: 'getInventory', label: 'Lấy kho vật phẩm', group: 'Cơ bản', args: [] },
  { action: 'getTreeInfo', label: 'Lấy bảng cây trồng', group: 'Cơ bản', args: [] },
  {
    action: 'getInfoFarm',
    label: 'Thông tin farm',
    group: 'Cơ bản',
    args: [{ name: 'type', label: 'type', default: 0 }],
  },

  {
    action: 'plantSeed',
    label: 'Trồng hạt',
    group: 'Ô đất',
    args: [user(), cell(), { name: 'idSeed', label: 'id hạt', default: 0 }],
    hint: 'wire: i32 idUser, i8 indexCell, i8 idSeed',
  },
  {
    action: 'harvest',
    label: 'Thu hoạch',
    group: 'Ô đất',
    args: [{ name: 'idFarm', label: 'id farm', default: 0 }, cell()],
  },
  {
    action: 'useItem',
    label: 'Dùng vật phẩm lên ô',
    group: 'Ô đất',
    args: [user(), cell(), { name: 'idItem', label: 'id vật phẩm', default: 0 }],
    hint: 'Tưới nước / nhổ cỏ / bắt sâu / bón phân đều qua đây, khác nhau ở idItem',
  },
  {
    action: 'openLand',
    label: 'Mở rộng đất',
    group: 'Ô đất',
    args: [{ name: 'idFarm', label: 'id farm', default: 0 }, { name: 'typeBuy', label: 'loại mua', default: 0 }],
  },

  {
    action: 'harvestAnimal',
    label: 'Thu hoạch vật nuôi',
    group: 'Vật nuôi',
    args: [{ name: 'idFarm', label: 'id farm', default: 0 }, { name: 'index', label: 'index', default: 0 }],
  },
  {
    action: 'buyAnimal',
    label: 'Mua vật nuôi',
    group: 'Vật nuôi',
    args: [{ name: 'idAnimal', label: 'id con vật', default: 0 }, { name: 'typeBuy', label: 'loại mua', default: 0 }],
  },
  {
    action: 'sellAnimal',
    label: 'Bán vật nuôi',
    group: 'Vật nuôi',
    args: [{ name: 'idFarm', label: 'id farm', default: 0 }, { name: 'iddb', label: 'iddb', default: 0 }],
  },

  {
    action: 'buyItem',
    label: 'Mua vật phẩm',
    group: 'Chợ',
    args: [
      { name: 'id', label: 'id', default: 0 },
      { name: 'num', label: 'số lượng', default: 1 },
      { name: 'typeShop', label: 'loại shop', default: 0 },
    ],
  },
  {
    action: 'sellItem',
    label: 'Bán vật phẩm',
    group: 'Chợ',
    args: [{ name: 'idItem', label: 'id vật phẩm', default: 0 }, { name: 'num', label: 'số lượng', default: 1 }],
  },

  { action: 'stealInfo', label: 'Thông tin trộm', group: 'Trộm', args: [] },
  { action: 'steal', label: 'Trộm', group: 'Trộm', args: [{ name: 'step', label: 'step', default: 0 }] },
  { action: 'stealStore', label: 'Trộm kho', group: 'Trộm', args: [] },
  { action: 'stealHistory', label: 'Lịch sử bị trộm', group: 'Trộm', args: [] },

  {
    action: 'cook',
    label: 'Nấu ăn',
    group: 'Bếp',
    args: [{ name: 'num', label: 'số lượng', default: 1 }, { name: 'id', label: 'id món', default: 0 }],
  },
  {
    action: 'harvestCook',
    label: 'Lấy món đã nấu',
    group: 'Bếp',
    args: [{ name: 'id', label: 'id', default: 0 }],
  },
  { action: 'getCook', label: 'Xem bếp', group: 'Bếp', args: [{ name: 'step', label: 'step', default: 0 }] },
];

export const GROUPS = [...new Set(ACTIONS.map((a) => a.group))];
