"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Loader2, Camera, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

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
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const handleClearPreview = () => {
    setPreview(null);
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {preview ? (
          <div className="space-y-4">
            <div className="relative w-full max-w-md mx-auto">
              <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden border">
                <Image
                  src={preview}
                  alt="Receipt preview"
                  fill
                  className="object-contain"
                />
              </div>
              {!scanning && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={handleClearPreview}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {scanning && (
              <div className="text-center py-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Analyzing receipt with AI...
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mb-4 flex justify-center gap-4">
              <Camera className="h-12 w-12 text-muted-foreground opacity-50" />
              <Upload className="h-12 w-12 text-muted-foreground opacity-50" />
            </div>
            <h3 className="font-semibold mb-2">Scan Receipt</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a photo of your receipt and we'll extract the transaction details automatically
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild variant="default" disabled={scanning}>
                <label htmlFor="receipt-upload" className="cursor-pointer">
                  {scanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Receipt
                    </>
                  )}
                  <input
                    id="receipt-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={scanning}
                  />
                </label>
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Supported formats: JPG, PNG (max 5MB)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
