"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Camera, X, FileText, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ReceiptData {
  amount: number;
  date: string;
  vendor: string;
  category: string;
  items?: string[];
  receiptUrl: string;
  fileName: string;
}

interface ReceiptScannerProps {
  onScanComplete: (data: ReceiptData) => void;
  onCancel?: () => void;
}

export function ReceiptScanner({ onScanComplete, onCancel }: ReceiptScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Scan receipt
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/receipts/scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to scan receipt");
      }

      const data = await response.json();

      toast({
        title: "Receipt scanned successfully",
        description: "Transaction data has been extracted",
      });

      onScanComplete(data);
    } catch (error: any) {
      console.error("Receipt scan error:", error);
      toast({
        title: "Scan failed",
        description: error.message || "Failed to scan receipt. Please try again.",
        variant: "destructive",
      });
      setPreview(null);
    } finally {
      setScanning(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClearPreview = () => {
    setPreview(null);
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-white/10 p-1">
          <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-black/50">
            <Image
              src={preview}
              alt="Receipt preview"
              fill
              className="object-contain"
            />
            
            {/* Overlay while scanning */}
            {scanning && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse" />
                  <Loader2 className="h-10 w-10 animate-spin relative z-10 text-blue-500" />
                </div>
                <p className="mt-4 font-medium text-lg">Analyzing Receipt...</p>
                <p className="text-sm text-slate-400">Extracting vendor, date, and amount</p>
              </div>
            )}

            {!scanning && (
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg"
                onClick={handleClearPreview}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-200 text-center",
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-slate-600"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center border border-white/5 shadow-inner">
              <Camera className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-2">Upload Receipt</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
            Drag and drop your receipt here, or click to browse files
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button asChild className="w-full h-11 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-medium">
              <label className="cursor-pointer">
                <ImageIcon className="h-4 w-4 mr-2" />
                Choose Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </Button>
            {onCancel && (
              <Button 
                variant="ghost" 
                onClick={onCancel}
                className="w-full h-11 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl"
              >
                Cancel
              </Button>
            )}
          </div>
          
          <p className="text-xs text-slate-500 mt-6">
            Supported formats: JPG, PNG • Max size: 5MB
          </p>
        </div>
      )}
    </div>
  );
}
