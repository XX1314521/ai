import { Layers3, Pencil, WandSparkles } from "lucide-react";
import { Button, Input, Modal } from "antd";

import { ModelPicker } from "@/components/model-picker";
import {
    commerceLanguageOptions,
    commerceOutputOptions,
    commercePlatformOptions,
    commerceRatioOptions,
    supportedCommerceRatios,
    type CommerceOutputType,
    type CommercePlatform,
    type CommerceTextLanguage,
} from "@/lib/commerce-specs";
import type { AiConfig } from "@/stores/use-config-store";
import { CommerceSelect } from "./commerce-select";

type CommerceSpecEditorProps = {
    open: boolean;
    config: AiConfig;
    imageModel: string;
    textModel: string;
    description: string;
    outputType: CommerceOutputType;
    platform: CommercePlatform;
    textLanguage: CommerceTextLanguage;
    onClose: () => void;
    onDescriptionChange: (value: string) => void;
    onOutputTypeChange: (value: CommerceOutputType) => void;
    onPlatformChange: (value: CommercePlatform) => void;
    onTextLanguageChange: (value: CommerceTextLanguage) => void;
    onSizeChange: (value: string) => void;
    onCountChange: (value: string) => void;
    onModelChange: (value: string) => void;
    onTextModelChange: (value: string) => void;
    onMissingConfig: () => void;
    onAiWrite: () => void;
    aiWriting: boolean;
};

export function CommerceSpecEditor({
    open,
    config,
    imageModel,
    textModel,
    description,
    outputType,
    platform,
    textLanguage,
    onClose,
    onDescriptionChange,
    onOutputTypeChange,
    onPlatformChange,
    onTextLanguageChange,
    onSizeChange,
    onCountChange,
    onModelChange,
    onTextModelChange,
    onMissingConfig,
    onAiWrite,
    aiWriting,
}: CommerceSpecEditorProps) {
    const supportedRatios = supportedCommerceRatios(config, imageModel);
    const ratioOptions = commerceRatioOptions.map((option) => ({ ...option, disabled: !supportedRatios.includes(option.value), hint: supportedRatios.includes(option.value) ? undefined : "当前模型不支持" }));
    const countOptions = [1, 2, 3, 4].map((count) => ({ value: String(count), label: `${count} 张` }));

    return (
        <Modal
            className="commerce-spec-modal"
            open={open}
            onCancel={onClose}
            footer={null}
            width={760}
            centered
            destroyOnHidden
            title={
                <div className="commerce-modal-title">
                    <span><Pencil className="size-5" /></span>
                    <div><strong>创作规格</strong><small>平台、文字和画面规格会直接用于提示词与生图请求</small></div>
                </div>
            }
        >
            <div className="commerce-spec-editor">
                <div className="commerce-spec-type-tabs" aria-label="素材类型">
                    {commerceOutputOptions.map((option) => (
                        <button key={option.value} type="button" className={outputType === option.value ? "is-active" : ""} onClick={() => onOutputTypeChange(option.value)}>
                            {option.label}{option.value === "ad" ? <em>NEW</em> : null}
                        </button>
                    ))}
                </div>

                <div className="commerce-spec-editor-grid">
                    <label>
                        <span>目标平台</span>
                        <CommerceSelect value={platform} options={commercePlatformOptions} onChange={onPlatformChange} ariaLabel="目标平台" />
                    </label>
                    <label>
                        <span>目标语言</span>
                        <CommerceSelect value={textLanguage} options={commerceLanguageOptions} onChange={onTextLanguageChange} ariaLabel="目标语言" />
                    </label>
                </div>

                <label className="commerce-spec-brief">
                    <span>创作要求 <button type="button" disabled={aiWriting} onClick={(event) => { event.preventDefault(); onAiWrite(); }}><WandSparkles className="size-4" />{aiWriting ? "正在帮写" : "AI 帮写"}</button></span>
                    <Input.TextArea
                        value={description}
                        rows={5}
                        maxLength={3000}
                        showCount
                        placeholder="建议输入：产品名称、卖点、目标人群、目标电商平台、图片风格等"
                        onChange={(event) => onDescriptionChange(event.target.value)}
                    />
                </label>

                <div className="commerce-spec-editor-grid is-four">
                    <label>
                        <span>画面比例 <small>按当前模型适配</small></span>
                        <CommerceSelect value={config.size} options={ratioOptions} onChange={onSizeChange} ariaLabel="画面比例" />
                    </label>
                    <label>
                        <span>生成张数</span>
                        <CommerceSelect value={config.count} options={countOptions} onChange={onCountChange} ariaLabel="生成张数" />
                    </label>
                    <div className="commerce-spec-model">
                        <span>生图模型</span>
                        <ModelPicker config={config} capability="image" value={imageModel} onChange={onModelChange} onMissingConfig={onMissingConfig} className="commerce-model-picker" contentClassName="commerce-model-picker-content" fullWidth />
                    </div>
                    <div className="commerce-spec-model">
                        <span>文本模型</span>
                        <ModelPicker config={config} capability="text" value={textModel} onChange={onTextModelChange} onMissingConfig={onMissingConfig} className="commerce-model-picker" contentClassName="commerce-model-picker-content" fullWidth />
                    </div>
                </div>

                <div className="commerce-spec-note"><Layers3 className="size-4" /><span>当前模型支持 {supportedRatios.join("、")}；切换模型后会自动匹配最接近的可用比例。</span></div>
                <div className="commerce-spec-actions"><Button type="primary" icon={<WandSparkles className="size-4" />} onClick={onClose}>应用规格</Button></div>
            </div>
        </Modal>
    );
}
