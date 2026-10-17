import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, ExternalLink, Check, Building2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { id: 1, name: "AI/ML" },
  { id: 2, name: "AdTech" },
  { id: 3, name: "Aerospace" },
  { id: 4, name: "AR/VR" },
  { id: 5, name: "Automotive" },
  { id: 6, name: "Cloud Computing" },
  { id: 7, name: "Cybersecurity" },
  { id: 8, name: "Digital Media" },
  { id: 9, name: "E-commerce & Retail" },
  { id: 10, name: "Fintech" },
  { id: 11, name: "Gaming" },
  { id: 12, name: "Health" },
  { id: 13, name: "IoT" },
  { id: 14, name: "Productivity" },
  { id: 15, name: "Robotics & Automation" },
  { id: 16, name: "Semiconductors" },
  { id: 17, name: "Sustainable Technology" },
  { id: 18, name: "Telecommunications" },
];

const SIZES = [
  { value: "xs", label: "1-10" },
  { value: "s", label: "11-50" },
  { value: "m", label: "51-200" },
  { value: "l", label: "201-1,000" },
  { value: "xl", label: "1,001+" },
];

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddCompanyModal({ open, onOpenChange }: AddCompanyModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    size: '',
    websiteUrl: '',
    careersUrl: '',
    city: '',
    street: '',
    houseNumber: '',
    companyNumber: '',
  });
  const [copied, setCopied] = useState(false);
  const [showYaml, setShowYaml] = useState(false);

  const generateJson = () => {
    const json: Record<string, unknown> = {
      name: formData.name,
      description: formData.description,
      categoryId: parseInt(formData.categoryId),
      size: formData.size,
      websiteUrl: formData.websiteUrl,
      careersUrl: formData.careersUrl,
      addresses: [
        {
          street: formData.street || undefined,
          houseNumber: formData.houseNumber || undefined,
          city: formData.city,
        }
      ],
      isMultinational: false,
      isActive: true
    };
    // Remove undefined values
    const addr = json.addresses as { street?: string; houseNumber?: string; city: string }[];
    if (!addr[0].street) delete addr[0].street;
    if (!addr[0].houseNumber) delete addr[0].houseNumber;
    return JSON.stringify(json, null, 2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.categoryId || !formData.size || !formData.city || !formData.careersUrl || !formData.companyNumber) {
      toast.error("Please fill in all required fields");
      return;
    }
    setShowYaml(true);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(generateJson());
    setCopied(true);
    toast.success("JSON copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const openGitHubPR = () => {
    // New company submissions go to this repo's public issue tracker so any
    // visitor can reach it (the pipeline repo is private).
    window.open(
      (import.meta.env.VITE_SUBMIT_COMPANY_URL as string) ||
        'https://github.com/c5fzs2ztdp-ui/techjobs/issues',
      '_blank',
      'noopener'
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      size: '',
      websiteUrl: '',
      careersUrl: '',
      city: '',
      street: '',
      houseNumber: '',
      companyNumber: '',
    });
    setShowYaml(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Add a Company to TechJobsIL
          </DialogTitle>
          <DialogDescription>
            Submit your company to be listed on TechJobsIL. This will create a pull request on GitHub.
          </DialogDescription>
        </DialogHeader>

        {!showYaml ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="companyNumber">Company Number (ח.פ) *</Label>
              <Input
                id="companyNumber"
                placeholder="e.g., 513674309"
                value={formData.companyNumber}
                onChange={(e) => setFormData({ ...formData, companyNumber: e.target.value })}
              />
              <p className="text-xs text-slate-500">Israeli company registration number from רשם החברות</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Acme (without Ltd/Limited)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., AI-powered analytics platform"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <p className="text-xs text-slate-500">One-liner tagline or mission statement</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="size">Size *</Label>
                <Select
                  value={formData.size}
                  onValueChange={(value) => setFormData({ ...formData, size: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://company.com"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="careersUrl">Careers URL *</Label>
                <Input
                  id="careersUrl"
                  type="url"
                  placeholder="https://company.com/careers"
                  value={formData.careersUrl}
                  onChange={(e) => setFormData({ ...formData, careersUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="City *"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="col-span-1"
                />
                <Input
                  placeholder="Street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="col-span-1"
                />
                <Input
                  placeholder="Number"
                  value={formData.houseNumber}
                  onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                  className="col-span-1"
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">
              Generate JSON for PR
            </Button>
          </form>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Generated JSON <span className="text-slate-500 font-normal">({formData.companyNumber}.json)</span></Label>
              <div className="relative">
                <Textarea
                  readOnly
                  value={generateJson()}
                  className="font-mono text-sm bg-slate-50 h-56"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 gap-1"
                  onClick={copyJson}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <p className="font-medium mb-2">Next steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copy the JSON above</li>
                <li>Click "Open GitHub" to create a new file</li>
                <li>Paste the JSON content</li>
                <li>Propose the change as a Pull Request</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowYaml(false)}
              >
                Back to Form
              </Button>
              <Button
                type="button"
                className="flex-1 bg-slate-900 hover:bg-slate-800 gap-2"
                onClick={openGitHubPR}
              >
                <ExternalLink className="w-4 h-4" />
                Open GitHub
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
