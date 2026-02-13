//
import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";

interface Section {
  id: string;
  title: string;
  description: string;
  targetPages: number;
  order: number;
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  description: string;
  targetPages: number;
  sections: Section[];
}

interface StructureData {
  suggestedTitle?: string;
  chapters: Chapter[];
}

interface Props {
  projectId: string;
  structureJson: string;
  canRedo: boolean;
  onApprove: () => void;
  onRefetch: () => void;
}

export default function StructureEditor({
  projectId,
  structureJson,
  canRedo,
  onApprove,
  onRefetch,
}: Props) {
  const [structure, setStructure] = useState<StructureData>(() =>
    JSON.parse(structureJson),
  );
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    () => new Set(structure.chapters.map((c) => c.id)),
  );
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [redoFeedback, setRedoFeedback] = useState("");
  const [showRedo, setShowRedo] = useState(false);

  const totalPages = structure.chapters.reduce((s, c) => s + c.targetPages, 0);

  // ── Toggle chapter expand ──
  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Start editing ──
  const startEdit = (fieldKey: string, currentValue: string) => {
    setEditingField(fieldKey);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = (fieldKey: string) => {
    const parts = fieldKey.split(".");
    const updated = {
      ...structure,
      chapters: structure.chapters.map((c) => ({
        ...c,
        sections: [...c.sections],
      })),
    };

    if (parts[0] === "title") {
      updated.suggestedTitle = editValue;
    } else if (parts.length === 2) {
      // chapter field: ch1.title, ch1.description
      const ch = updated.chapters.find((c) => c.id === parts[0]);
      if (ch) (ch as any)[parts[1]] = editValue;
    } else if (parts.length === 3) {
      // section field: ch1.s1.title
      const ch = updated.chapters.find((c) => c.id === parts[0]);
      const sec = ch?.sections.find((s) => s.id === parts[1]);
      if (sec) (sec as any)[parts[2]] = editValue;
    }

    setStructure(updated);
    setEditingField(null);
    setEditValue("");
  };

  // ── Pages editing ──
  const updateChapterPages = (chapterId: string, pages: number) => {
    setStructure((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === chapterId ? { ...c, targetPages: Math.max(1, pages) } : c,
      ),
    }));
  };

  const updateSectionPages = (
    chapterId: string,
    sectionId: string,
    pages: number,
  ) => {
    setStructure((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              sections: c.sections.map((s) =>
                s.id === sectionId
                  ? { ...s, targetPages: Math.max(0.5, pages) }
                  : s,
              ),
            }
          : c,
      ),
    }));
  };

  // ── Add/Remove ──
  const addChapter = () => {
    const num = structure.chapters.length + 1;
    const newCh: Chapter = {
      id: `ch${num}-${Date.now()}`,
      number: num,
      title: "New Chapter",
      description: "Chapter description",
      targetPages: 2,
      sections: [
        {
          id: `ch${num}-s1-${Date.now()}`,
          title: "New Section",
          description: "Section description",
          targetPages: 1,
          order: 0,
        },
      ],
    };
    setStructure((prev) => ({ ...prev, chapters: [...prev.chapters, newCh] }));
  };

  const removeChapter = (id: string) => {
    if (structure.chapters.length <= 1)
      return toast.error("Need at least 1 chapter");
    setStructure((prev) => ({
      ...prev,
      chapters: prev.chapters
        .filter((c) => c.id !== id)
        .map((c, i) => ({ ...c, number: i + 1 })),
    }));
  };

  const addSection = (chapterId: string) => {
    setStructure((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) => {
        if (c.id !== chapterId) return c;
        const order = c.sections.length;
        return {
          ...c,
          sections: [
            ...c.sections,
            {
              id: `${chapterId}-s${order + 1}-${Date.now()}`,
              title: "New Section",
              description: "Section description",
              targetPages: 0.5,
              order,
            },
          ],
        };
      }),
    }));
  };

  const removeSection = (chapterId: string, sectionId: string) => {
    setStructure((prev) => ({
      ...prev,
      chapters: prev.chapters.map((c) => {
        if (c.id !== chapterId) return c;
        if (c.sections.length <= 1) {
          toast.error("Need at least 1 section");
          return c;
        }
        return {
          ...c,
          sections: c.sections
            .filter((s) => s.id !== sectionId)
            .map((s, i) => ({ ...s, order: i })),
        };
      }),
    }));
  };

  // ── Save to backend ──
  const saveStructure = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/projects/${projectId}/structure`, {
        chapters: structure.chapters,
      });
      toast.success("Structure saved!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Redo ──
  const handleRedo = async () => {
    try {
      await apiClient.post(`/projects/${projectId}/structure/redo`, {
        feedback: redoFeedback,
      });
      toast.success("Regenerating structure...");
      setShowRedo(false);
      onRefetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Redo failed");
    }
  };

  // ── Editable field ──
  const EditableText = ({
    fieldKey,
    value,
    tag = "span",
    className = "",
  }: {
    fieldKey: string;
    value: string;
    tag?: string;
    className?: string;
  }) => {
    if (editingField === fieldKey) {
      return (
        <div className="flex items-center gap-2 flex-1">
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(fieldKey);
              if (e.key === "Escape") cancelEdit();
            }}
            className="flex-1 px-2 py-1 border border-primary-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={() => saveEdit(fieldKey)}
            className="p-1 text-green-600 hover:text-green-700"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelEdit}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    const Tag = tag as any;
    return (
      <Tag
        className={`${className} group cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors`}
        onClick={() => startEdit(fieldKey, value)}
      >
        {value}
        <Pencil className="w-3 h-3 inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Tag>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary-500" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Book Structure
          </h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            {structure.chapters.length} chapters • {totalPages} pages
          </span>
        </div>
      </div>

      {/* Book title */}
      {structure.suggestedTitle && (
        <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-950/50 rounded-xl border border-primary-100 dark:border-primary-900">
          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase mb-1">
            Book Title
          </p>
          <EditableText
            fieldKey="title"
            value={structure.suggestedTitle}
            tag="h2"
            className="text-xl font-bold text-gray-900 dark:text-white"
          />
        </div>
      )}

      {/* Chapters */}
      <div className="space-y-3 mb-6">
        {structure.chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Chapter header */}
            <div className="flex items-center gap-3 p-4">
              <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <button
                onClick={() => toggleChapter(chapter.id)}
                className="text-gray-500 dark:text-gray-400"
              >
                {expandedChapters.has(chapter.id) ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">
                    CH {chapter.number}
                  </span>
                  <EditableText
                    fieldKey={`${chapter.id}.title`}
                    value={chapter.title}
                    className="font-semibold text-gray-900 dark:text-white truncate"
                  />
                </div>
                <EditableText
                  fieldKey={`${chapter.id}.description`}
                  value={chapter.description}
                  className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block"
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      updateChapterPages(chapter.id, chapter.targetPages - 1)
                    }
                    className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs"
                  >
                    -
                  </button>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-center">
                    {chapter.targetPages}p
                  </span>
                  <button
                    onClick={() =>
                      updateChapterPages(chapter.id, chapter.targetPages + 1)
                    }
                    className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeChapter(chapter.id)}
                  className="p-1 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sections */}
            {expandedChapters.has(chapter.id) && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50">
                {chapter.sections.map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center gap-3 px-4 py-3 pl-16 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <EditableText
                        fieldKey={`${chapter.id}.${section.id}.title`}
                        value={section.title}
                        className="text-sm font-medium text-gray-800 dark:text-gray-200"
                      />
                      <EditableText
                        fieldKey={`${chapter.id}.${section.id}.description`}
                        value={section.description}
                        className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updateSectionPages(
                              chapter.id,
                              section.id,
                              section.targetPages - 0.5,
                            )
                          }
                          className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 text-xs"
                        >
                          -
                        </button>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-6 text-center">
                          {section.targetPages}p
                        </span>
                        <button
                          onClick={() =>
                            updateSectionPages(
                              chapter.id,
                              section.id,
                              section.targetPages + 0.5,
                            )
                          }
                          className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 text-xs"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeSection(chapter.id, section.id)}
                        className="p-0.5 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addSection(chapter.id)}
                  className="flex items-center gap-2 px-4 py-2 pl-16 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 w-full transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add chapter */}
      <button
        onClick={addChapter}
        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center gap-2 mb-6"
      >
        <Plus className="w-4 h-4" /> Add Chapter
      </button>

      {/* Redo section */}
      {canRedo && (
        <div className="mb-6">
          {showRedo ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                What should be changed? (optional)
              </p>
              <textarea
                value={redoFeedback}
                onChange={(e) => setRedoFeedback(e.target.value)}
                rows={2}
                placeholder="e.g., Add more practical examples, split chapter 2..."
                className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none resize-none mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRedo}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => setShowRedo(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowRedo(true)}
              className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700"
            >
              <RotateCcw className="w-4 h-4" /> Regenerate structure with AI
              (one-time)
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={saveStructure}
          disabled={saving}
          className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={onApprove}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold text-lg shadow-lg shadow-green-600/25"
        >
          <Check className="w-5 h-5" /> Approve & Continue
        </button>
      </div>
    </div>
  );
}
