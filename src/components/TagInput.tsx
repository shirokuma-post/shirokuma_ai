"use client";
import { useState, useRef, KeyboardEvent } from "react";

interface TagInputProps {
  value: string;  // カンマ区切り文字列
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxTags?: number;
}

export default function TagInput({ value, onChange, onBlur, placeholder = "入力してEnterで追加", maxTags = 10 }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // カンマ区切り文字列 → タグ配列
  const tags = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (tags.includes(tag)) return;
    if (tags.length >= maxTags) return;
    const next = [...tags, tag].join(", ");
    onChange(next);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    const next = tags.filter((_, i) => i !== index).join(", ");
    onChange(next);
    onBlur?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
      onBlur?.();
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 min-h-[34px] px-2 py-1 border border-gray-200 rounded-md bg-white cursor-text focus-within:ring-1 focus-within:ring-brand-500 focus-within:border-brand-500"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium border border-brand-200">
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
            className="ml-0.5 text-brand-400 hover:text-brand-600 focus:outline-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) addTag(inputValue);
          onBlur?.();
        }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[60px] text-xs bg-transparent border-none outline-none placeholder:text-gray-300"
      />
    </div>
  );
}
