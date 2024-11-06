<template>
    <div class="endpoint">
        <h3>{{ endpoint }}</h3>
        <p><strong>Method:</strong> {{ getHttpMethod(spec) }}</p>
        <p>
            <strong>Description:</strong>
            {{
                spec[getHttpMethod(spec)].description ||
                'No description available'
            }}
        </p>

        <div
            v-if="
               hasParams
            "
        >
            <h4>Parameters</h4>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>In</th>
                        <th>Type</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="parameter in params"
                        :key="parameter.name"
                    >
                        <td>{{ parameter.name }}</td>
                        <td><Paramtype :paramtype="parameter.in"/></td>
                        <td><Paramdatatype :datatype="parameter.schema.type" :required="parameter.required"/></td>
                        <td>
                            {{
                                parameter.description ||
                                'No description available'
                            }}
                        </td>
                    </tr>
                    <tr v-for="bodyParam in bodyParams">
                        <td>{{ bodyParam.name }}</td>
                        <td><Paramtype paramtype="body"/></td>
                        <td><Paramdatatype :datatype="bodyParam.type" :required="bodyParam.required"/></td>
                        <td>{{ bodyParam.description }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="spec[getHttpMethod(spec)].responses">
            <h4>Responses</h4>
            <table>
                <thead>
                    <tr>
                        <th>Status Code</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(response, code) in spec[getHttpMethod(spec)]
                            .responses"
                        :key="code"
                    >
                        <td>{{ code }}</td>
                        <td>
                            {{
                                response.description ||
                                'No description available'
                            }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Paramtype from './Paramtype.vue';
import Paramdatatype from './Paramdatatype.vue';
const props = defineProps<{
    endpoint: string;
    spec: unknown;
    schema: Record<string, unknown>
}>();

// Helper function to get the first HTTP method available in the spec
function getHttpMethod(spec: any) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    return methods.find((method) => spec[method]);
}

const methodSpec = computed(() => props.spec[getHttpMethod(props.spec)]);

const params = computed(() => {
    if (methodSpec.value.parameters) {
        return methodSpec.value.parameters
    }
    return [];
});

const dtoref = computed(()=>{
    if(methodSpec.value.requestBody){
        return methodSpec.value.requestBody.content['application/json'].schema.$ref
    }
})
const body = computed(()=>{
    if(dtoref.value){
        return props.schema[dtoref.value.split('/')[3]]
    }
})
const bodyParams = computed(()=>{
    if(body.value){
        return Object.entries(body.value.properties).map(([key, value]) => {
            const required = body.value.required.includes(key)
            return {
                name: key,
                type: value.type,
                description: value.description,
                required
            }
        })
    }
    return []
})

const hasParams = computed(() => params.value.length > 0 || bodyParams.value.length > 0);
</script>

<style scoped>
.endpoint {
    border: 1px solid #ddd;
    padding: 16px;
    margin-bottom: 16px;
    background-color: #f9f9f9;
    border-radius: 8px;
}

h3 {
    color: #333;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}

th,
td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}

th {
    background-color: #f4f4f4;
}

p {
    margin: 4px 0;
}

h4 {
    margin-top: 16px;
    color: #666;
}
</style>
