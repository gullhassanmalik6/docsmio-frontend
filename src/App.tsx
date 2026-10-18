import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { SiteShell } from '@/components/layout/site-shell'
import { WorkspaceShell } from '@/components/layout/workspace-shell'
import { BlogArticlePage } from '@/pages/blog-article-page'
import { BlogPage } from '@/pages/blog-page'
import { FeaturesPage } from '@/pages/features-page'
import { HelpPage } from '@/pages/help-page'
import { HomePage } from '@/pages/home-page'
import { LoginPage } from '@/pages/login-page'
import { MyFilesPage } from '@/pages/my-files-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { PricingPage } from '@/pages/pricing-page'
import { PrivacyPage } from '@/pages/privacy-page'
import { SettingsPage } from '@/pages/settings-page'
import { SignupPage } from '@/pages/signup-page'
import { ToolsPage } from '@/pages/tools-page'
import { UnavailableToolPage } from '@/pages/unavailable-tool-page'

const ImageResizePage = lazy(() => import('@/pages/image-resize-page').then((module) => ({ default: module.ImageResizePage })))
const CompressPdfPage = lazy(() => import('@/pages/compress-pdf-page').then((module) => ({ default: module.CompressPdfPage })))
const MergePdfPage = lazy(() => import('@/pages/merge-pdf-page').then((module) => ({ default: module.MergePdfPage })))
const SplitPdfPage = lazy(() => import('@/pages/split-pdf-page').then((module) => ({ default: module.SplitPdfPage })))
const ConvertPage = lazy(() => import('@/pages/convert-page').then((module) => ({ default: module.ConvertPage })))
const JpgToPdfPage = lazy(() => import('@/pages/image-to-pdf-page').then((module) => ({ default: module.JpgToPdfPage })))
const ImagesToPdfRoute = lazy(() => import('@/pages/image-to-pdf-page').then((module) => ({ default: module.ImagesToPdfRoute })))
const ScanPage = lazy(() => import('@/pages/scan-page').then((module) => ({ default: module.ScanPage })))
const WatermarkPage = lazy(() => import('@/pages/watermark-page').then((module) => ({ default: module.WatermarkPage })))

export default function App() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route index element={<HomePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/image-resize" element={<ImageResizePage />} />
        <Route path="tools/compress-pdf" element={<CompressPdfPage />} />
        <Route path="tools/merge-pdf" element={<MergePdfPage />} />
        <Route path="tools/split-pdf" element={<SplitPdfPage />} />
        <Route path="tools/pdf-to-word" element={<UnavailableToolPage slug="pdf-to-word" />} />
        <Route path="tools/word-to-pdf" element={<UnavailableToolPage slug="word-to-pdf" />} />
        <Route path="tools/image-to-pdf" element={<ImagesToPdfRoute />} />
        <Route path="tools/jpg-to-pdf" element={<JpgToPdfPage />} />
        <Route path="tools/convert" element={<ConvertPage />} />
        <Route path="tools/scan" element={<ScanPage />} />
        <Route path="tools/watermark" element={<WatermarkPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="blog" element={<BlogPage />} />
        <Route path="blog/:slug" element={<BlogArticlePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route element={<WorkspaceShell />}>
          <Route path="files" element={<MyFilesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
