const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Saves a file. Inside a Claude preview the viewer's own save prompt is used;
// on the real site it is a normal browser download.
export const saveFile = async (buf: ArrayBuffer, name: string): Promise<'saved' | 'declined' | 'failed'> => {
  const claude = (window as any).claude;
  if (claude?.use) {
    const downloads = await claude.use('downloads');
    if (downloads) {
      try {
        await downloads.save({ filename: name, data: new Blob([buf], { type: XLSX_TYPE }) });
        return 'saved';
      } catch (e: any) {
        return e?.code === 'declined' ? 'declined' : 'failed';
      }
    }
  }
  const url = URL.createObjectURL(new Blob([buf], { type: XLSX_TYPE }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
};
