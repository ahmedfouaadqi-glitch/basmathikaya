
type PageRow = { page_number: number; text: string; image_url: string | null; image_prompt?: string | null };

function AdminPageEditor({ orderId, page, onChanged, imagesReady, regening, onRegen, orderNumber }: {
  orderId: string;
  page: PageRow;
  onChanged: () => void;
  imagesReady: boolean;
  regening: boolean;
  onRegen: () => void;
  orderNumber: number;
}) {
  const updateTextFn = useServerFn(adminUpdatePageText);
  const uploadFn = useServerFn(adminUploadPageImage);
  const updatePromptFn = useServerFn(adminUpdatePagePrompt);
  const [text, setText] = useState(page.text ?? "");
  const [prompt, setPrompt] = useState(page.image_prompt ?? "");
  const [savingText, setSavingText] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function saveText() {
    setSavingText(true);
    try {
      await updateTextFn({ data: { orderId, pageNumber: page.page_number, text } });
      toast.success("تم حفظ النص");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setSavingText(false); }
  }
  async function savePrompt() {
    setSavingPrompt(true);
    try {
      await updatePromptFn({ data: { orderId, pageNumber: page.page_number, imagePrompt: prompt } });
      toast.success("تم حفظ الموجّه");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setSavingPrompt(false); }
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await uploadFn({ data: { orderId, pageNumber: page.page_number, dataUrl } });
      toast.success("تم رفع الصورة");
      onChanged();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطأ"); }
    finally { setUploading(false); e.target.value = ""; }
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {page.image_url ? (
        <img src={page.image_url} alt={`page-${page.page_number}`} className="aspect-square w-full object-cover" />
      ) : (
        <div className="aspect-square w-full flex items-center justify-center bg-secondary/30 text-muted-foreground text-xs">
          {imagesReady ? "—" : "بانتظار الدفع"}
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="text-xs font-bold text-primary">صفحة {page.page_number}</div>
          <div className="inline-flex gap-1 flex-wrap">
            {page.image_url && (
              <a href={page.image_url} download={`order-${orderNumber}-page-${page.page_number}.png`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary">
                <Download className="size-3" />
              </a>
            )}
            <label className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary cursor-pointer">
              {uploading ? <Loader2 className="size-3 animate-spin" /> : "رفع صورة"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} disabled={uploading} />
            </label>
            {imagesReady && (
              <button onClick={onRegen} disabled={regening}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary disabled:opacity-60">
                {regening ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                توليد
              </button>
            )}
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full rounded-lg border bg-background p-2 text-xs leading-relaxed"
        />
        <div className="flex justify-end">
          <button onClick={saveText} disabled={savingText || text === (page.text ?? "")}
            className="rounded-md bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50">
            {savingText ? "..." : "حفظ النص"}
          </button>
        </div>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">موجّه الصورة (Prompt)</summary>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border bg-background p-2 text-[11px]"
            placeholder="وصف مشهد الصورة (بالإنجليزية غالباً)"
          />
          <div className="mt-1 flex justify-end">
            <button onClick={savePrompt} disabled={savingPrompt || prompt === (page.image_prompt ?? "")}
              className="rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary disabled:opacity-50">
              {savingPrompt ? "..." : "حفظ الموجّه"}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
