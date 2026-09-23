import React from 'react';
import { useRouter } from '../context/RouterContext';
import { EXCLUDED_STUDENT_NUMBERS } from '../data/whitelist';
import {
  ShieldCheck,
  BookOpen,
  Users,
  Lock,
  ArrowRight,
  HardDrive,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-stone-200 pb-6">
        <div className="inline-flex items-center gap-1.5 text-xs font-mono text-stone-500 mb-2">
          <span>Charter & Specifications</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          About KUCSE25 Academic Archive
        </h1>
        <p className="mt-2 text-sm text-stone-600 leading-relaxed">
          The centralized, free academic repository for Computer Science & Engineering Batch 25 at Khulna University, Bangladesh.
        </p>
      </div>

      {/* Core Mission */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-stone-700" />
          <span>Purpose & Philosophy</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          KUCSE25 is dedicated strictly as an <strong>academic resource archive</strong>, not a social network. University coursework produces immense volumes of valuable slides, handwritten lecture notes, laboratory project templates, and past semester final examination solutions that often get lost across scattered group chats and ephemeral file links.
        </p>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          This platform establishes an immutable, structured repository where any university student can freely browse, read in-browser, and download study materials without requiring an account.
        </p>
      </section>

      {/* Strict Public Privacy Rule */}
      <section className="p-5 bg-white border border-stone-200 rounded-md space-y-3">
        <div className="flex items-center gap-2 text-stone-900">
          <Lock className="w-4 h-4 text-stone-700" />
          <h2 className="text-sm font-bold tracking-tight">Public Display Privacy Standard</h2>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">
          To maintain a clutter-free, distractionless academic interface and protect student privacy, public resource cards display <strong>only</strong>:
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-800">
          <li className="flex items-center gap-2 p-2 bg-stone-50 rounded border border-stone-200">
            <span className="font-mono text-stone-900 font-bold">1.</span>
            <span>File Name</span>
          </li>
          <li className="flex items-center gap-2 p-2 bg-stone-50 rounded border border-stone-200">
            <span className="font-mono text-stone-900 font-bold">2.</span>
            <span>Uploader Name</span>
          </li>
          <li className="flex items-center gap-2 p-2 bg-stone-50 rounded border border-stone-200">
            <span className="font-mono text-stone-900 font-bold">3.</span>
            <span>Download Count</span>
          </li>
          <li className="flex items-center gap-2 p-2 bg-stone-50 rounded border border-stone-200">
            <span className="font-mono text-stone-900 font-bold">4.</span>
            <span>Read & Download Buttons</span>
          </li>
        </ul>
        <p className="text-[11px] text-stone-500 pt-1">
          Private student emails, student ID numbers, upload timestamps, storage paths, and moderation logs are never exposed on public cards.
        </p>
      </section>

      {/* KUCSE25 Student Whitelist Specification */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-stone-700" />
          <span>Student Email Whitelist Verification</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          While anyone can freely read and download resources publicly, uploading is restricted to enrolled Khulna University CSE Batch 25 students.
        </p>

        <div className="p-4 bg-stone-50 border border-stone-200 rounded-md space-y-2.5">
          <div className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
            Verification Specification
          </div>
          <div className="space-y-1.5 text-xs text-stone-700">
            <p>
              • <strong>Email Format:</strong> <code className="bg-stone-200 px-1.5 py-0.5 rounded font-mono text-stone-900 text-[11px]">2502**@ku.ac.bd</code>
            </p>
            <p>
              • <strong>Allowed Rolls:</strong> 01 through 43
            </p>
            <p>
              • <strong>Roster Exclusions:</strong> Rolls {Array.from(EXCLUDED_STUDENT_NUMBERS).join(', ')} are excluded per batch registration records.
            </p>
            <p>
              • <strong>Total Verified Batch Roster:</strong> 39 students
            </p>
          </div>
        </div>
      </section>

      {/* Moderation & Governance */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <Users className="w-4 h-4 text-stone-700" />
          <span>Moderation & Administration</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          Submitted resources are held in a pending queue until verified by the Class Representative (CR) or Assistant Class Representative (ACR). Reviewers check for:
        </p>
        <ul className="space-y-1.5 text-xs text-stone-600 list-disc list-inside">
          <li>Legibility of handwriting and scans (minimum 300 DPI recommended for mobile screens)</li>
          <li>Proper course categorization and descriptive file nomenclature</li>
          <li>Accurate assignment or exam term year labeling</li>
          <li>Academic integrity and absence of corrupt or malicious files</li>
        </ul>
      </section>

      {/* Storage & Architecture */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-stone-700" />
          <span>Storage-Conscious Architecture</span>
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          Because KUCSE25 is a community academic initiative operated within storage boundaries, files undergo compression and duplicate checking prior to permanent indexing.
        </p>
      </section>

      <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
        >
          <span>Explore Course Catalog</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
