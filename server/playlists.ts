import ExcelJS from 'exceljs';
import type { Track } from '../shared/types.js';
import { trackOf } from './normalize.js';
import { Upstream } from './upstream.js';

export interface PlaylistRow {
  index: number;
  id: string;
  track: Track | null;
  addedAt: number | null;
  addedAtSource: string;
  addedBy: string;
}
export interface PlaylistExport {
  id: string;
  name: string;
  creator: string;
  description: string;
  createdAt: number | null;
  updatedAt: number | null;
  subscribedAt: number | null;
  declaredCount: number;
  fetchedAt: number;
  rows: PlaylistRow[];
}
export async function listPlaylists(api: Upstream, uid: string) {
  const playlists: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await api.call('user_playlist', { uid, limit: 100, offset });
    const page = result.playlist || [];
    playlists.push(...page);
    if (!result.more || !page.length) break;
  }
  return playlists.map((p) => ({
    id: String(p.id),
    name: p.name,
    cover: p.coverImgUrl,
    trackCount: p.trackCount,
    creator: p.creator?.nickname || '',
    owned: String(p.creator?.userId) === uid,
    createdAt: p.createTime || null,
    updatedAt: p.updateTime || null,
    subscribedAt: p.subscribedTime || p.subscribeTime || null,
  }));
}
export async function fetchPlaylist(api: Upstream, id: string): Promise<PlaylistExport> {
  const detail = await api.call('playlist_detail', { id });
  const p = detail.playlist;
  if (!p) throw new Error('歌单不存在或当前账号无权访问');
  const ids: any[] = p.trackIds || (p.tracks || []).map((t: any) => ({ id: t.id }));
  const tracks = new Map<string, Track>();
  for (const raw of p.tracks || []) {
    const t = trackOf(raw);
    if (t) tracks.set(t.id, t);
  }
  const missing = ids.filter((i) => !tracks.has(String(i.id)));
  for (let i = 0; i < missing.length; i += 200) {
    const result = await api.call('song_detail', {
      ids: missing
        .slice(i, i + 200)
        .map((t) => t.id)
        .join(','),
    });
    for (const raw of result.songs || []) {
      const t = trackOf(raw);
      if (t) tracks.set(t.id, t);
    }
  }
  return {
    id,
    name: p.name,
    creator: p.creator?.nickname || '',
    description: p.description || '',
    createdAt: p.createTime || null,
    updatedAt: p.updateTime || null,
    subscribedAt: p.subscribedTime || p.subscribeTime || null,
    declaredCount: p.trackCount ?? ids.length,
    fetchedAt: Date.now(),
    rows: ids.map((entry, i) => ({
      index: i + 1,
      id: String(entry.id),
      track: tracks.get(String(entry.id)) || null,
      addedAt: entry.addTime || entry.at || null,
      addedAtSource: entry.addTime ? 'trackIds.addTime' : entry.at ? 'trackIds.at' : '',
      addedBy: entry.uid ? String(entry.uid) : '',
    })),
  };
}
const formatDate = (v: number | null) =>
  v
    ? new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Shanghai',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(v)
    : '';
const duration = (v: number | null | undefined) =>
  v == null ? '' : `${Math.floor(v / 60000)}:${String(Math.floor(v / 1000) % 60).padStart(2, '0')}`;
const note =
  '时间为北京时间。收藏歌单时间仅取 subscribeTime/subscribedTime；条目时间取 trackIds.addTime 或 at（保留字段来源，at 的含义需以账号实际响应核验）。未返回的时间留空；创建时间、更新时间不能替代收藏时间。缺失歌曲详情仍保留原始歌曲 ID 和顺序。';
function values(r: PlaylistRow) {
  return [
    r.index,
    r.track?.name || '详情不可用',
    r.track?.artists.map((a) => a.name).join(' / ') || '',
    r.track?.album || '',
    duration(r.track?.duration),
    r.id,
    `https://music.163.com/song?id=${r.id}`,
    formatDate(r.addedAt),
    r.addedAtSource,
    r.addedBy,
  ];
}
const headers = [
  '序号',
  '歌曲',
  '歌手',
  '专辑',
  '歌曲时长',
  '歌曲 ID',
  '歌曲链接',
  '歌单条目时间',
  '时间字段来源',
  '添加者 ID',
];
export function playlistMarkdown(p: PlaylistExport) {
  const escape = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\|/g, '\\|')
      .replace(/[\r\n]+/g, ' ');
  const line = (r: unknown[]) => `| ${r.map(escape).join(' | ')} |`;
  return `# ${escape(p.name)}\n\n- 歌单：https://music.163.com/playlist?id=${p.id}\n- 创建者：${escape(p.creator)}\n- 导出时间：${formatDate(p.fetchedAt)}\n- 创建时间：${formatDate(p.createdAt) || '未返回'}\n- 更新时间：${formatDate(p.updatedAt) || '未返回'}\n- 收藏歌单时间：${formatDate(p.subscribedAt) || '未返回'}\n- 接口标记歌曲数：${p.declaredCount}；导出条目数：${p.rows.length}\n\n${escape(p.description)}\n\n${note}\n\n${line(headers)}\n${line(headers.map(() => '---'))}\n${p.rows.map((r) => line(values(r))).join('\n')}\n`;
}
export async function playlistExcel(p: PlaylistExport) {
  const book = new ExcelJS.Workbook();
  book.creator = 'NeteaseMusic Analyze';
  const sheet = book.addWorksheet('歌单', { views: [{ state: 'frozen', ySplit: 7 }] });
  sheet.columns = [8, 32, 28, 32, 14, 24, 52, 25, 24, 24].map((width) => ({ width }));
  sheet.mergeCells('A1:J1');
  sheet.getCell('A1').value = p.name;
  sheet.getCell('A1').font = { size: 20, bold: true, color: { argb: 'FF182B2B' } };
  sheet.getRow(1).height = 35;
  sheet.mergeCells('A2:J2');
  sheet.getCell('A2').value =
    `创建者：${p.creator} ｜ 歌单声明 ${p.declaredCount} 首 ｜ 导出 ${p.rows.length} 条 ｜ ${formatDate(p.fetchedAt)}`;
  sheet.mergeCells('A3:J3');
  sheet.getCell('A3').value =
    `收藏歌单时间：${formatDate(p.subscribedAt) || '未返回'} ｜ 创建：${formatDate(p.createdAt) || '未返回'} ｜ 更新：${formatDate(p.updatedAt) || '未返回'}`;
  sheet.mergeCells('A4:J5');
  sheet.getCell('A4').value = note;
  sheet.getCell('A4').alignment = { wrapText: true, vertical: 'middle' };
  sheet.getRow(4).height = 26;
  sheet.getRow(5).height = 26;
  sheet.mergeCells('A6:J6');
  sheet.getCell('A6').value =
    `来源：https://music.163.com/playlist?id=${p.id} · /playlist/detail + /song/detail`;
  sheet.getRow(7).values = headers;
  sheet.getRow(7).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF21776B' } };
  });
  for (const r of p.rows) {
    const row = sheet.addRow(values(r));
    // Excel serial is intentionally shifted to the declared display timezone (Asia/Shanghai).
    if (r.addedAt) {
      row.getCell(8).value = new Date(r.addedAt + 8 * 3600000);
      row.getCell(8).numFmt = 'yyyy-mm-dd hh:mm:ss';
    }
    row.getCell(7).value = { text: '打开歌曲', hyperlink: `https://music.163.com/song?id=${r.id}` };
    row.height = 24;
    if (r.index % 2 === 0)
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F6F5' } };
      });
  }
  sheet.autoFilter = { from: 'A7', to: `J${Math.max(7, p.rows.length + 7)}` };
  return book.xlsx.writeBuffer();
}
